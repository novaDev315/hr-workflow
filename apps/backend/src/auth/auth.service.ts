import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
  employees,
  roles,
  userRoleAssignments,
  users,
} from '../database/drizzle/schema';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  BootstrapAdminInput,
  ChangePasswordInput,
  CreateEmployeeAccountInput,
  LoginInput,
  ProvisionStaffAccessInput,
  RevokeStaffAccessInput,
} from './auth.types';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { LAST_ADMIN_REVOKE_MESSAGE, lockActiveAdmins } from './admin-guard';
import { findUniqueViolation } from '../employee/unique-violation';
import { createFirstAdminAccount, ensureSystemRole } from './bootstrap-admin';
import { LoginRateLimiter } from './login-rate-limiter';
import { isBootstrapAllowed } from './runtime-config';
import { bumpSessionVersion } from './session-version';
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
  sessionVersion: number;
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

/** Maps a raced duplicate (users_email_key / one account per employee) to a client conflict. */
function rethrowAccountConflict(error: unknown): never {
  if (findUniqueViolation(error)) {
    throw new ConflictException('An account already exists for this employee email');
  }
  throw error;
}

// Fixed bcrypt hash compared against for unknown emails so response time does
// not reveal whether an account exists.
const DUMMY_PASSWORD_HASH =
  '$2b$10$zds56RkHHnUzxVXNrm.ruOcKZErR2d.qTdjPR.mv0/ngtf9uaJlT2';

const HR_ADMIN_GRANTABLE_ROLES: AdminAccessRoleKey[] = ['MANAGER', 'SUPERVISOR'];

@Injectable()
export class AuthService {
  private readonly loginLimiter = new LoginRateLimiter();

  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async getBootstrapStatus() {
    const [countRow] = await this.database.drizzle
      .select({ count: count() })
      .from(users);
    const accountCount = Number(countRow?.count ?? 0);

    return {
      bootstrapRequired: accountCount === 0 && isBootstrapAllowed(),
      accountCount,
    };
  }

  async bootstrapAdmin(input: BootstrapAdminInput) {
    if (!isBootstrapAllowed()) {
      throw new ForbiddenException('Bootstrap is disabled');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 10);

    const userId = await createFirstAdminAccount(this.database.drizzle, {
      email: normalizedEmail,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
    });

    if (!userId) {
      throw new ForbiddenException(
        'Bootstrap is only allowed before the first user exists',
      );
    }

    const userWithRoles = await this.getUserWithRolesById(userId);
    if (!userWithRoles) {
      throw new NotFoundException('Bootstrap account could not be loaded');
    }

    return this.buildAuthPayload(userWithRoles);
  }

  async login(input: LoginInput, clientIp: string | null = null) {
    const normalizedEmail = input.email.trim().toLowerCase();
    this.loginLimiter.assertAllowed(normalizedEmail, clientIp);

    const user = await this.getUserWithRolesByEmail(normalizedEmail);

    // Always run one bcrypt comparison so unknown emails cost the same time.
    const passwordValid = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordValid) {
      this.loginLimiter.recordFailure(normalizedEmail, clientIp);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    this.loginLimiter.clearEmail(normalizedEmail);
    return this.buildAuthPayload(user);
  }

  /** Revokes every token issued to the current user. */
  async logout(currentUser?: AuthenticatedUser) {
    if (currentUser?.userId) {
      await bumpSessionVersion(this.database.drizzle, currentUser.userId);
    }

    return true;
  }

  /**
   * Changes the signed-in user's own password. Wrong current passwords count
   * toward the login limit for that email. Every older token is revoked and a
   * fresh session is returned so the caller stays signed in.
   */
  async changePassword(currentUser: AuthenticatedUser, input: ChangePasswordInput) {
    const user = await this.getUserWithRolesById(currentUser.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const limiterEmail = user.email.trim().toLowerCase();
    this.loginLimiter.assertAllowed(limiterEmail, null);

    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      this.loginLimiter.recordFailure(limiterEmail, null);
      throw new BadRequestException('Current password is incorrect');
    }

    // bcrypt ignores everything after 72 bytes; MaxLength counts characters.
    if (Buffer.byteLength(input.newPassword, 'utf8') > 72) {
      throw new BadRequestException('newPassword: must be at most 72 bytes');
    }

    if (input.newPassword === input.currentPassword) {
      throw new BadRequestException('Choose a new password that is different from the current one');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    // Guard on the old hash and session version so a concurrent change,
    // logout or revoke can't be silently overwritten.
    const [updated] = await this.database.drizzle
      .update(users)
      .set({
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(users.id, user.id),
          eq(users.passwordHash, user.passwordHash),
          eq(users.sessionVersion, user.sessionVersion),
        ),
      )
      .returning({ sessionVersion: users.sessionVersion });

    if (!updated) {
      throw new ConflictException('Your account changed while saving. Sign in again and retry.');
    }

    this.loginLimiter.clearEmail(limiterEmail);
    return this.buildAuthPayload({ ...user, passwordHash, sessionVersion: updated.sessionVersion });
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
    const [existing] = await this.database.drizzle
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.key, data.key))
      .limit(1);

    if (existing) {
      throw new ConflictException(`Role ${data.key} already exists`);
    }

    const [created] = await this.database.drizzle
      .insert(roles)
      .values({
        id: randomUUID(),
        key: data.key,
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
      })
      .returning({
        id: roles.id,
        key: roles.key,
        name: roles.name,
        description: roles.description,
      });

    return created;
  }

  async createEmployeeAccount(
    currentUser: AuthenticatedUser,
    input: CreateEmployeeAccountInput,
  ) {
    this.assertCanManageAccounts(currentUser.roles);
    const employeeId = input.employeeId.trim();
    const passwordHash = await bcrypt.hash(input.password, 10);

    const createdUser = await this.database.drizzle.transaction(async (tx) => {
      const [employee] = await tx
        .select({
          id: employees.id,
          email: employees.email,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
        .limit(1);

      if (!employee) {
        throw new NotFoundException('Employee not found or inactive');
      }

      const [linkedUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.employeeId, employeeId))
        .limit(1);

      if (linkedUser) {
        throw new ConflictException('This employee already has a linked account');
      }

      const [existingEmailUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = LOWER(${employee.email})`)
        .limit(1);

      if (existingEmailUser) {
        throw new ConflictException(
          'An account already exists for this employee email',
        );
      }

      const employeeRole = await this.ensureRole('EMPLOYEE', tx);

      const [user] = await tx
        .insert(users)
        .values({
          id: randomUUID(),
          email: employee.email.trim().toLowerCase(),
          employeeId: employee.id,
          passwordHash,
          firstName: employee.firstName,
          lastName: employee.lastName,
        })
        .returning({ id: users.id })
        .catch(rethrowAccountConflict);

      await tx.insert(userRoleAssignments).values({
        id: randomUUID(),
        userId: user.id,
        roleId: employeeRole.id,
      });

      const userWithRoles = await this.getUserWithRolesById(user.id, tx);
      if (!userWithRoles) {
        throw new NotFoundException('Employee account could not be loaded');
      }

      return userWithRoles;
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

    // ADMIN may grant any staff role; HR_ADMIN only MANAGER or SUPERVISOR.
    if (
      !currentUser.roles.includes('ADMIN') &&
      !HR_ADMIN_GRANTABLE_ROLES.includes(roleKey)
    ) {
      throw new ForbiddenException(
        'Only ADMIN accounts can grant the ADMIN or HR_ADMIN role',
      );
    }

    return this.database.drizzle.transaction(async (tx) => {
      const [employee] = await tx
        .select({
          id: employees.id,
          email: employees.email,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
        .limit(1);

      if (!employee) {
        throw new NotFoundException('Employee not found or inactive');
      }

      const employeeRole = await this.ensureRole('EMPLOYEE', tx);
      const staffRole = await this.ensureRole(roleKey, tx);

      let [account] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.employeeId, employeeId))
        .limit(1);

      if (!account) {
        if (!input.password?.trim()) {
          throw new BadRequestException(
            'A temporary password is required when creating a new staff account',
          );
        }

        const [existingEmailAccount] = await tx
          .select({ id: users.id })
          .from(users)
          .where(sql`LOWER(${users.email}) = LOWER(${employee.email})`)
          .limit(1);

        if (existingEmailAccount) {
          throw new ConflictException(
            'An account already exists for this employee email',
          );
        }

        const [createdAccount] = await tx
          .insert(users)
          .values({
            id: randomUUID(),
            email: employee.email.trim().toLowerCase(),
            employeeId: employee.id,
            passwordHash: await bcrypt.hash(input.password.trim(), 10),
            firstName: employee.firstName,
            lastName: employee.lastName,
          })
          .returning({ id: users.id })
          .catch(rethrowAccountConflict);
        account = createdAccount;
      }

      await this.assignRoleIfMissing(account.id, employeeRole.id, tx);
      await this.assignRoleIfMissing(account.id, staffRole.id, tx);
      await bumpSessionVersion(tx, account.id);

      const accountWithRoles = await this.getUserWithRolesById(account.id, tx);

      if (!accountWithRoles) {
        throw new NotFoundException('Provisioned account could not be loaded');
      }

      return this.mapUser(accountWithRoles);
    });
  }

  async revokeStaffAccess(
    currentUser: AuthenticatedUser,
    input: RevokeStaffAccessInput,
  ) {
    if (!currentUser.roles.includes('ADMIN')) {
      throw new ForbiddenException('Only ADMIN accounts can revoke staff access');
    }

    const employeeId = input.employeeId.trim();
    const roleKey = input.roleKey.trim().toUpperCase() as AdminAccessRoleKey;

    if (!ADMIN_ACCESS_ROLE_KEYS.includes(roleKey)) {
      throw new BadRequestException(
        'Staff access role must be ADMIN, HR_ADMIN, MANAGER, or SUPERVISOR',
      );
    }

    return this.database.drizzle.transaction(async (tx) => {
      const [account] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.employeeId, employeeId))
        .limit(1);

      if (!account) {
        throw new NotFoundException('No account exists for this employee');
      }

      if (roleKey === 'ADMIN') {
        if (account.id === currentUser.userId) {
          throw new ConflictException(
            'You cannot remove your own ADMIN role. Ask another ADMIN to do it.',
          );
        }

        // Serialize concurrent ADMIN changes: lock all active ADMIN rows (and
        // their users) in a stable order, then re-check under the lock that the
        // acting admin still holds an active ADMIN assignment and that another
        // active ADMIN remains once the target loses the role.
        const lockedAdmins = await lockActiveAdmins(tx);
        const actorStillAdmin = lockedAdmins.some((row) => row.userId === currentUser.userId);
        const otherActiveAdmins = lockedAdmins.filter((row) => row.userId !== account.id);
        if (!actorStillAdmin || otherActiveAdmins.length === 0) {
          throw new ConflictException(LAST_ADMIN_REVOKE_MESSAGE);
        }
      }

      const [staffRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.key, roleKey))
        .limit(1);

      const removed = staffRole
        ? await tx
            .delete(userRoleAssignments)
            .where(
              and(
                eq(userRoleAssignments.userId, account.id),
                eq(userRoleAssignments.roleId, staffRole.id),
              ),
            )
            .returning({ id: userRoleAssignments.id })
        : [];

      if (removed.length === 0) {
        throw new BadRequestException(`This account does not hold the ${roleKey} role`);
      }

      await bumpSessionVersion(tx, account.id);

      const accountWithRoles = await this.getUserWithRolesById(account.id, tx);

      if (!accountWithRoles) {
        throw new NotFoundException('Account could not be loaded');
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
        ver: user.sessionVersion,
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

  private ensureRole(key: SystemRoleKey, db: any = this.database.drizzle) {
    return ensureSystemRole(key, db);
  }

  private async assignRoleIfMissing(
    accountId: string,
    roleId: string,
    db: any = this.database.drizzle,
  ) {
    const [existingAssignment] = await db
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, accountId),
          eq(userRoleAssignments.roleId, roleId),
        ),
      )
      .limit(1);

    if (existingAssignment) {
      return existingAssignment;
    }

    const [createdAssignment] = await db
      .insert(userRoleAssignments)
      .values({
        id: randomUUID(),
        userId: accountId,
        roleId,
      })
      .returning({ id: userRoleAssignments.id });

    return createdAssignment;
  }

  private async getUserWithRolesByEmail(
    email: string,
    db: any = this.database.drizzle,
  ) {
    const user = await this.findUserByEmail(email, db);

    if (!user) {
      return null;
    }

    return this.attachRoles(user, db);
  }

  private async getUserWithRolesById(
    id: string,
    db: any = this.database.drizzle,
  ) {
    const user = await this.findUserById(id, db);

    if (!user) {
      return null;
    }

    return this.attachRoles(user, db);
  }

  private async findUserByEmail(email: string, db: any = this.database.drizzle) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        employeeId: users.employeeId,
        passwordHash: users.passwordHash,
        firstName: users.firstName,
        lastName: users.lastName,
        isActive: users.isActive,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  private async findUserById(id: string, db: any = this.database.drizzle) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        employeeId: users.employeeId,
        passwordHash: users.passwordHash,
        firstName: users.firstName,
        lastName: users.lastName,
        isActive: users.isActive,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }

  private async attachRoles(
    user: UserRow,
    db: any = this.database.drizzle,
  ): Promise<UserWithRoles> {
    const roleRows = await this.findRolesForUser(user.id, db);
    const employeeProfile = await this.findEmployeeProfile(
      user.employeeId ?? null,
      db,
    );

    return {
      ...user,
      employeeProfile: employeeProfile ?? undefined,
      roleAssignments: roleRows.map((role) => ({
        role,
      })),
    };
  }

  private async findRolesForUser(
    userId: string,
    db: any = this.database.drizzle,
  ): Promise<RoleRow[]> {
    const rows = await db
      .select({ key: roles.key })
      .from(roles)
      .innerJoin(userRoleAssignments, eq(userRoleAssignments.roleId, roles.id))
      .where(eq(userRoleAssignments.userId, userId))
      .orderBy(asc(roles.name));

    return rows.map((role) => ({
      key: role.key as SystemRoleKey,
    }));
  }

  private async findEmployeeProfile(
    employeeId: string | null,
    db: any = this.database.drizzle,
  ) {
    if (!employeeId) {
      return null;
    }

    const [profile] = await db
      .select({
        employeeId: employees.id,
        employeeNumber: employees.employeeNumber,
        departmentName: departments.name,
        designationTitle: designations.title,
        employeeStatus: employees.status,
      })
      .from(employees)
      .innerJoin(departments, eq(departments.id, employees.departmentId))
      .innerJoin(designations, eq(designations.id, employees.designationId))
      .where(eq(employees.id, employeeId))
      .limit(1);

    return profile ?? null;
  }
}
