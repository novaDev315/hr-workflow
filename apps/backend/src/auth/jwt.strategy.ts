import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { roles, userRoleAssignments, users } from '../database/drizzle/schema';
import type { AuthenticatedUser } from '../common/current-user.decorator';
import { resolveJwtSecret } from './runtime-config';

export interface JwtPayload {
  sub: string;
  email?: string;
  ver?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly database: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService.get<string>('JWT_SECRET')),
    });
  }

  /**
   * Never trusts claims beyond the user id and session version: the account,
   * its active flag and its roles are loaded from the database on every
   * request, so deactivation, logout and role changes take effect at once.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || typeof payload.ver !== 'number') {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const [user] = await this.database.drizzle
      .select({
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || !user.isActive || user.sessionVersion !== payload.ver) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const roleRows = await this.database.drizzle
      .select({ key: roles.key })
      .from(roles)
      .innerJoin(userRoleAssignments, eq(userRoleAssignments.roleId, roles.id))
      .where(eq(userRoleAssignments.userId, user.id))
      .orderBy(asc(roles.name));

    return {
      userId: user.id,
      email: user.email,
      roles: roleRows.map((role) => role.key),
    };
  }
}
