import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  BootstrapAdminInput,
  CreateEmployeeAccountInput,
  LoginInput,
  ProvisionStaffAccessInput,
} from './auth.types';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  AccountManagerRoleKey,
  AdminAccessRoleKey,
  ADMIN_ACCESS_ROLE_KEYS,
  ACCOUNT_MANAGER_ROLE_KEYS,
  DEFAULT_ADMIN_ROLE,
  SYSTEM_ROLE_DETAILS,
  SystemRoleKey,
} from '../common/system-roles';

interface UserRow {
  id: string;
  email: string;
  employeeId?: string | null;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface RoleRow {
  key: SystemRoleKey;
}

type UserWithRoles = UserRow & {
  employeeProfile?: {
    employeeId: string | null;
    employeeNumber: string | null;
    departmentName: string | null;
    designationTitle: string | null;
    employeeStatus: string | null;
  };
  roleAssignments: Array<{
    role: RoleRow;
  }>;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async getBootstrapStatus() {
    const countRow = await this.database.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users`,
    );
    const accountCount = Number(countRow?.count ?? '0');

    return {
      bootstrapRequired: accountCount === 0,
      accountCount,
    };
  }

  async bootstrapAdmin(input: BootstrapAdminInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 10);

    const createdUser = await this.database.transaction(async (tx) => {
      const countRow = await this.database.one<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users`,
        [],
        tx,
      );
      const userCount = Number(countRow?.count ?? '0');

      if (userCount > 0) {
        throw new ForbiddenException(
          'Bootstrap is only allowed before the first user exists',
        );
      }

      const adminRole = await this.ensureRole(DEFAULT_ADMIN_ROLE, tx);

      const user = await this.database.one<{ id: string }>(
        `
          INSERT INTO users (
            id,
            email,
            employee_id,
            password_hash,
            first_name,
            last_name
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          randomUUID(),
          normalizedEmail,
          null,
          passwordHash,
          input.firstName.trim(),
          input.lastName.trim(),
        ],
        tx,
      );

      await this.database.query(
        `
          INSERT INTO user_role_assignments (id, user_id, role_id)
          VALUES ($1, $2, $3)
        `,
        [randomUUID(), user!.id, adminRole.id],
        tx,
      );

      return this.getUserWithRolesById(user!.id, tx);
    });

    return this.buildAuthPayload(createdUser);
  }

  async login(input: LoginInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.getUserWithRolesByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthPayload(user);
  }

  async logout() {
    return true;
  }

  async getCurrentUser(userId: string) {
    const user = await this.getUserWithRolesById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUser(user);
  }

  async createRole(data: {
    key: SystemRoleKey;
    name: string;
    description?: string;
  }) {
    const existing = await this.database.one<{ id: string }>(
      `SELECT id FROM roles WHERE key = $1`,
      [data.key],
    );

    if (existing) {
      throw new ConflictException(`Role ${data.key} already exists`);
    }

    return this.database.one<{
      id: string;
      key: string;
      name: string;
      description: string | null;
    }>(
      `
        INSERT INTO roles (id, key, name, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, key, name, description
      `,
      [randomUUID(), data.key, data.name.trim(), data.description?.trim() ?? null],
    );
  }

  async createEmployeeAccount(
    currentUser: AuthenticatedUser,
    input: CreateEmployeeAccountInput,
  ) {
    this.assertCanManageAccounts(currentUser.roles);
    const employeeId = input.employeeId.trim();
    const passwordHash = await bcrypt.hash(input.password, 10);

    const createdUser = await this.database.transaction(async (tx) => {
      const employee = await this.database.one<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      }>(
        `
          SELECT
            id,
            email,
            first_name AS "firstName",
            last_name AS "lastName"
          FROM employees
          WHERE id = $1 AND is_active = TRUE
        `,
        [employeeId],
        tx,
      );

      if (!employee) {
        throw new NotFoundException('Employee not found or inactive');
      }

      const linkedUser = await this.database.one<{ id: string }>(
        `SELECT id FROM users WHERE employee_id = $1`,
        [employeeId],
        tx,
      );

      if (linkedUser) {
        throw new ConflictException('This employee already has a linked account');
      }

      const existingEmailUser = await this.database.one<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
        [employee.email],
        tx,
      );

      if (existingEmailUser) {
        throw new ConflictException(
          'An account already exists for this employee email',
        );
      }

      const employeeRole = await this.ensureRole('EMPLOYEE', tx);

      const user = await this.database.one<{ id: string }>(
        `
          INSERT INTO users (
            id,
            email,
            employee_id,
            password_hash,
            first_name,
            last_name
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        [
          randomUUID(),
          employee.email.trim().toLowerCase(),
          employee.id,
          passwordHash,
          employee.firstName,
          employee.lastName,
        ],
        tx,
      );

      await this.database.query(
        `
          INSERT INTO user_role_assignments (id, user_id, role_id)
          VALUES ($1, $2, $3)
        `,
        [randomUUID(), user!.id, employeeRole.id],
        tx,
      );

      return this.getUserWithRolesById(user!.id, tx);
    });

    return this.buildAuthPayload(createdUser);
  }

  async provisionStaffAccess(
    currentUser: AuthenticatedUser,
    input: ProvisionStaffAccessInput,
  ) {
    this.assertCanManageAccounts(currentUser.roles);

    const employeeId = input.employeeId.trim();
    const roleKey = input.roleKey.trim().toUpperCase() as AdminAccessRoleKey;

    if (!ADMIN_ACCESS_ROLE_KEYS.includes(roleKey)) {
      throw new BadRequestException(
        'Staff access role must be ADMIN, HR_ADMIN, MANAGER, or SUPERVISOR',
      );
    }

    return this.database.transaction(async (tx) => {
      const employee = await this.database.one<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      }>(
        `
          SELECT
            id,
            email,
            first_name AS "firstName",
            last_name AS "lastName"
          FROM employees
          WHERE id = $1 AND is_active = TRUE
        `,
        [employeeId],
        tx,
      );

      if (!employee) {
        throw new NotFoundException('Employee not found or inactive');
      }

      const employeeRole = await this.ensureRole('EMPLOYEE', tx);
      const staffRole = await this.ensureRole(roleKey, tx);

      let account = await this.database.one<{ id: string }>(
        `SELECT id FROM users WHERE employee_id = $1`,
        [employeeId],
        tx,
      );

      if (!account) {
        if (!input.password?.trim()) {
          throw new BadRequestException(
            'A temporary password is required when creating a new staff account',
          );
        }

        const existingEmailAccount = await this.database.one<{ id: string }>(
          `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
          [employee.email],
          tx,
        );

        if (existingEmailAccount) {
          throw new ConflictException(
            'An account already exists for this employee email',
          );
        }

        account = await this.database.one<{ id: string }>(
          `
            INSERT INTO users (
              id,
              email,
              employee_id,
              password_hash,
              first_name,
              last_name
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `,
          [
            randomUUID(),
            employee.email.trim().toLowerCase(),
            employee.id,
            await bcrypt.hash(input.password.trim(), 10),
            employee.firstName,
            employee.lastName,
          ],
          tx,
        );
      }

      await this.assignRoleIfMissing(account.id, employeeRole.id, tx);
      await this.assignRoleIfMissing(account.id, staffRole.id, tx);

      const accountWithRoles = await this.getUserWithRolesById(account.id, tx);

      if (!accountWithRoles) {
        throw new NotFoundException('Provisioned account could not be loaded');
      }

      return this.mapUser(accountWithRoles);
    });
  }

  private buildAuthPayload(user: UserWithRoles) {
    const mappedUser = this.mapUser(user);
    const expiresIn = process.env.JWT_EXPIRY ?? '3600s';

    return {
      accessToken: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        roles: mappedUser.roles,
      }),
      expiresIn,
      account: mappedUser,
    };
  }

  private mapUser(user: UserWithRoles) {
    const roles = user.roleAssignments.map((assignment) => assignment.role.key);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      isActive: user.isActive,
      roles,
      canAccessAdminPanel: this.canAccessAdminPanel(roles),
      canManageAccounts: this.canManageAccounts(roles),
      employeeId: user.employeeProfile?.employeeId ?? null,
      employeeNumber: user.employeeProfile?.employeeNumber ?? null,
      departmentName: user.employeeProfile?.departmentName ?? null,
      designationTitle: user.employeeProfile?.designationTitle ?? null,
      employeeStatus: user.employeeProfile?.employeeStatus ?? null,
    };
  }

  private assertCanManageAccounts(roles: string[]) {
    if (!this.canManageAccounts(roles)) {
      throw new ForbiddenException(
        'Only ADMIN and HR_ADMIN accounts can manage employee and staff access',
      );
    }
  }

  private canAccessAdminPanel(roles: string[]) {
    return roles.some((role) =>
      ADMIN_ACCESS_ROLE_KEYS.includes(role as AdminAccessRoleKey),
    );
  }

  private canManageAccounts(roles: string[]) {
    return roles.some((role) =>
      ACCOUNT_MANAGER_ROLE_KEYS.includes(role as AccountManagerRoleKey),
    );
  }

  private async ensureRole(key: SystemRoleKey, client?: any) {
    const existingRole = await this.database.one<{ id: string }>(
      `SELECT id FROM roles WHERE key = $1`,
      [key],
      client,
    );

    if (existingRole) {
      return existingRole;
    }

    const details = SYSTEM_ROLE_DETAILS[key];

    return this.database.one<{ id: string }>(
      `
        INSERT INTO roles (id, key, name, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [randomUUID(), key, details.name, details.description],
      client,
    );
  }

  private async assignRoleIfMissing(
    accountId: string,
    roleId: string,
    client?: any,
  ) {
    const existingAssignment = await this.database.one<{ id: string }>(
      `
        SELECT id
        FROM user_role_assignments
        WHERE user_id = $1 AND role_id = $2
      `,
      [accountId, roleId],
      client,
    );

    if (existingAssignment) {
      return existingAssignment;
    }

    return this.database.one<{ id: string }>(
      `
        INSERT INTO user_role_assignments (id, user_id, role_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [randomUUID(), accountId, roleId],
      client,
    );
  }

  private async getUserWithRolesByEmail(email: string, client?: any) {
    const user = await this.database.one<UserRow>(
      `
        SELECT
          id,
          email,
          employee_id AS "employeeId",
          password_hash AS "passwordHash",
          first_name AS "firstName",
          last_name AS "lastName",
          is_active AS "isActive"
        FROM users
        WHERE email = $1
      `,
      [email],
      client,
    );

    if (!user) {
      return null;
    }

    return this.attachRoles(user, client);
  }

  private async getUserWithRolesById(id: string, client?: any) {
    const user = await this.database.one<UserRow>(
      `
        SELECT
          id,
          email,
          employee_id AS "employeeId",
          password_hash AS "passwordHash",
          first_name AS "firstName",
          last_name AS "lastName",
          is_active AS "isActive"
        FROM users
        WHERE id = $1
      `,
      [id],
      client,
    );

    if (!user) {
      return null;
    }

    return this.attachRoles(user, client);
  }

  private async attachRoles(user: UserRow, client?: any): Promise<UserWithRoles> {
    const roles = await this.database.many<RoleRow>(
      `
        SELECT r.key AS key
        FROM roles r
        INNER JOIN user_role_assignments ura ON ura.role_id = r.id
        WHERE ura.user_id = $1
        ORDER BY r.name ASC
      `,
      [user.id],
      client,
    );

    const employeeProfile = await this.database.one<{
      employeeId: string | null;
      employeeNumber: string | null;
      departmentName: string | null;
      designationTitle: string | null;
      employeeStatus: string | null;
    }>(
      `
        SELECT
          e.id AS "employeeId",
          e.employee_number AS "employeeNumber",
          d.name AS "departmentName",
          des.title AS "designationTitle",
          e.status AS "employeeStatus"
        FROM employees e
        INNER JOIN departments d ON d.id = e.department_id
        INNER JOIN designations des ON des.id = e.designation_id
        WHERE e.id = $1
        LIMIT 1
      `,
      [user.employeeId ?? null],
      client,
    );

    return {
      ...user,
      employeeProfile: employeeProfile ?? undefined,
      roleAssignments: roles.map((role) => ({
        role,
      })),
    };
  }
}
