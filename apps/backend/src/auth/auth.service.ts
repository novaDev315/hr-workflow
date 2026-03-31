import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { BootstrapAdminInput, LoginInput } from './auth.types';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  DEFAULT_ADMIN_ROLE,
  SystemRoleKey,
} from '../common/system-roles';

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface RoleRow {
  key: SystemRoleKey;
}

type UserWithRoles = UserRow & {
  roleAssignments: Array<{
    role: RoleRow;
  }>;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getBootstrapStatus() {
    const countRow = await this.prisma.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users`,
    );
    const userCount = Number(countRow?.count ?? '0');

    return {
      bootstrapRequired: userCount === 0,
      userCount,
    };
  }

  async bootstrapAdmin(input: BootstrapAdminInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 10);

    const createdUser = await this.prisma.transaction(async (tx) => {
      const countRow = await this.prisma.one<{ count: string }>(
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

      let adminRole = await this.prisma.one<{ id: string }>(
        `SELECT id FROM roles WHERE key = $1`,
        [DEFAULT_ADMIN_ROLE],
        tx,
      );

      if (!adminRole) {
        adminRole = await this.prisma.one<{ id: string }>(
          `
            INSERT INTO roles (id, key, name, description)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `,
          [
            randomUUID(),
            DEFAULT_ADMIN_ROLE,
            'Administrator',
            'Platform administrator with full access',
          ],
          tx,
        );
      }

      const user = await this.prisma.one<{ id: string }>(
        `
          INSERT INTO users (
            id,
            email,
            password_hash,
            first_name,
            last_name
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [
          randomUUID(),
          normalizedEmail,
          passwordHash,
          input.firstName.trim(),
          input.lastName.trim(),
        ],
        tx,
      );

      await this.prisma.query(
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
    const existing = await this.prisma.one<{ id: string }>(
      `SELECT id FROM roles WHERE key = $1`,
      [data.key],
    );

    if (existing) {
      throw new ConflictException(`Role ${data.key} already exists`);
    }

    return this.prisma.one<{
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
      user: mappedUser,
    };
  }

  private mapUser(user: UserWithRoles) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      isActive: user.isActive,
      roles: user.roleAssignments.map((assignment) => assignment.role.key),
    };
  }

  private async getUserWithRolesByEmail(email: string, client?: any) {
    const user = await this.prisma.one<UserRow>(
      `
        SELECT
          id,
          email,
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
    const user = await this.prisma.one<UserRow>(
      `
        SELECT
          id,
          email,
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
    const roles = await this.prisma.many<RoleRow>(
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

    return {
      ...user,
      roleAssignments: roles.map((role) => ({
        role,
      })),
    };
  }
}
