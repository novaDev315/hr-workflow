import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  ne,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DatabaseService } from '../database/database.service';
import {
  employees,
  leaveRequests as leaveRequestsTable,
  leaveTypes as leaveTypesTable,
  users,
} from '../database/drizzle/schema';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  ACCOUNT_MANAGER_ROLE_KEYS,
  ADMIN_ACCESS_ROLE_KEYS,
} from '../common/system-roles';
import {
  canAccessEmployeeWithinScope,
  EmployeeVisibilityScope,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import {
  CreateLeaveTypeInput,
  DeactivateLeaveTypeInput,
  LeaveRequestFilterInput,
  RequestLeaveInput,
  ReviewLeaveRequestInput,
  UpdateLeaveTypeInput,
} from './leave.types';

interface LeaveTypeRow {
  id: string;
  code: string;
  name: string;
  defaultDays: number;
  description: string | null;
  isActive: boolean;
}

interface LeaveRequestRow {
  id: string;
  employeeId: string;
  departmentId: string | null;
  supervisorId: string | null;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string;
  requestedAt: string;
  decidedAt: string | null;
  decisionNotes: string | null;
  employeeNumber: string;
  employeeName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeDefaultDays: number;
  leaveTypeDescription: string | null;
  leaveTypeIsActive: boolean;
  reviewedByName: string | null;
}

interface LeaveBalanceRow extends LeaveTypeRow {
  leaveTypeId: string;
  usedDays: number | null;
}

const leaveReviewers = alias(users, 'leave_reviewers');

@Injectable()
export class LeaveService {
  constructor(private readonly database: DatabaseService) {}

  async leaveTypes() {
    const rows = await this.database.drizzle
      .select(this.leaveTypeSelectFields())
      .from(leaveTypesTable)
      .where(eq(leaveTypesTable.isActive, true))
      .orderBy(asc(leaveTypesTable.name));

    return rows.map((row) => this.mapLeaveType(row));
  }

  async createLeaveType(
    currentUser: AuthenticatedUser,
    input: CreateLeaveTypeInput,
  ) {
    this.assertCanManageLeavePolicies(currentUser.roles);

    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const defaultDays = Number(input.defaultDays);

    if (!Number.isFinite(defaultDays) || defaultDays <= 0) {
      throw new BadRequestException('Default days must be greater than zero');
    }

    const [existing] = await this.database.drizzle
      .select({ id: leaveTypesTable.id })
      .from(leaveTypesTable)
      .where(
        or(
          eq(leaveTypesTable.code, code),
          sql`LOWER(${leaveTypesTable.name}) = LOWER(${name})`,
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('A leave type with this code or name already exists');
    }

    const [created] = await this.database.drizzle
      .insert(leaveTypesTable)
      .values({
        id: randomUUID(),
        code,
        name,
        defaultDays,
        description: input.description?.trim() ?? null,
        isActive: true,
      })
      .returning({ id: leaveTypesTable.id });

    return this.findLeaveType(created.id);
  }

  async updateLeaveType(
    currentUser: AuthenticatedUser,
    input: UpdateLeaveTypeInput,
  ) {
    this.assertCanManageLeavePolicies(currentUser.roles);
    const existing = await this.findLeaveType(input.id);
    const code = input.code?.trim().toUpperCase() ?? existing.code;
    const name = input.name?.trim() ?? existing.name;
    const defaultDays =
      input.defaultDays !== undefined ? Number(input.defaultDays) : existing.defaultDays;

    if (!Number.isFinite(defaultDays) || defaultDays <= 0) {
      throw new BadRequestException('Default days must be greater than zero');
    }

    const [duplicate] = await this.database.drizzle
      .select({ id: leaveTypesTable.id })
      .from(leaveTypesTable)
      .where(
        and(
          or(
            eq(leaveTypesTable.code, code),
            sql`LOWER(${leaveTypesTable.name}) = LOWER(${name})`,
          ),
          ne(leaveTypesTable.id, input.id),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictException('A leave type with this code or name already exists');
    }

    await this.database.drizzle
      .update(leaveTypesTable)
      .set({
        code,
        name,
        defaultDays,
        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : existing.description,
        updatedAt: sql`NOW()`,
      })
      .where(eq(leaveTypesTable.id, input.id));

    return this.findLeaveType(input.id);
  }

  async deactivateLeaveType(
    currentUser: AuthenticatedUser,
    input: DeactivateLeaveTypeInput,
  ) {
    this.assertCanManageLeavePolicies(currentUser.roles);
    await this.findLeaveType(input.id);

    await this.database.drizzle
      .update(leaveTypesTable)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(leaveTypesTable.id, input.id));

    return this.findLeaveType(input.id);
  }

  async requestLeave(currentUser: AuthenticatedUser, input: RequestLeaveInput) {
    const employeeId = await this.resolveScopedEmployeeId(
      currentUser,
      input.employeeId.trim(),
    );
    const startDate = this.parseDate(input.startDate, 'start date');
    const endDate = this.parseDate(input.endDate, 'end date');

    if (endDate < startDate) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const [leaveType] = await this.database.drizzle
      .select(this.leaveTypeSelectFields())
      .from(leaveTypesTable)
      .where(
        and(
          eq(leaveTypesTable.id, input.leaveTypeId),
          eq(leaveTypesTable.isActive, true),
        ),
      )
      .limit(1);

    if (!leaveType) {
      throw new NotFoundException('Leave type not found or inactive');
    }

    const [employee] = await this.database.drizzle
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
      .limit(1);

    if (!employee) {
      throw new NotFoundException('Employee not found or inactive');
    }

    const [overlapping] = await this.database.drizzle
      .select({ id: leaveRequestsTable.id })
      .from(leaveRequestsTable)
      .where(
        and(
          eq(leaveRequestsTable.employeeId, employeeId),
          inArray(leaveRequestsTable.status, ['PENDING', 'APPROVED']),
          sql`daterange(${leaveRequestsTable.startDate}, ${leaveRequestsTable.endDate}, '[]')
            && daterange(${this.formatDate(startDate)}::date, ${this.formatDate(endDate)}::date, '[]')`,
        ),
      )
      .limit(1);

    if (overlapping) {
      throw new ConflictException(
        'This leave request overlaps with an existing pending or approved request',
      );
    }

    const totalDays = this.calculateTotalDays(startDate, endDate);
    const [created] = await this.database.drizzle
      .insert(leaveRequestsTable)
      .values({
        id: randomUUID(),
        employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        totalDays,
        reason: input.reason.trim(),
        status: 'PENDING',
        requestedAt: sql`NOW()`,
      })
      .returning({ id: leaveRequestsTable.id });

    return this.findRequest(created.id);
  }

  async reviewLeaveRequest(
    currentUser: AuthenticatedUser,
    input: ReviewLeaveRequestInput,
  ) {
    this.assertCanReviewLeaveRequests(currentUser.roles);

    const status = input.status.trim().toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Review status must be APPROVED or REJECTED');
    }

    const [existing] = await this.database.drizzle
      .select({
        id: leaveRequestsTable.id,
        status: leaveRequestsTable.status,
        employeeId: leaveRequestsTable.employeeId,
        departmentId: employees.departmentId,
        supervisorId: employees.supervisorId,
      })
      .from(leaveRequestsTable)
      .innerJoin(employees, eq(employees.id, leaveRequestsTable.employeeId))
      .where(eq(leaveRequestsTable.id, input.requestId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }

    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Only pending leave requests can be reviewed');
    }

    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    if (
      !canAccessEmployeeWithinScope(scope, {
        employeeId: existing.employeeId,
        departmentId: existing.departmentId,
        supervisorId: existing.supervisorId,
      })
    ) {
      throw new ForbiddenException(
        'This account is not allowed to review leave for the requested employee',
      );
    }

    await this.database.drizzle
      .update(leaveRequestsTable)
      .set({
        status,
        decisionNotes: input.decisionNotes?.trim() ?? null,
        decidedByUserId: currentUser.userId,
        decidedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(leaveRequestsTable.id, input.requestId));

    return this.findRequest(input.requestId);
  }

  async leaveRequests(
    currentUser: AuthenticatedUser,
    filter?: LeaveRequestFilterInput,
  ) {
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const where: SQL[] = [];
    const visibilityClause = this.buildEmployeeVisibilityCondition(scope);

    if (visibilityClause) {
      where.push(visibilityClause);
    }

    if (filter?.employeeId?.trim()) {
      const scopedEmployeeId = await this.resolveScopedEmployeeId(
        currentUser,
        filter.employeeId,
      );
      where.push(eq(leaveRequestsTable.employeeId, scopedEmployeeId));
    }

    if (filter?.status) {
      where.push(eq(leaveRequestsTable.status, filter.status.trim().toUpperCase()));
    }

    if (filter?.fromDate) {
      where.push(gte(leaveRequestsTable.startDate, filter.fromDate));
    }

    if (filter?.toDate) {
      where.push(lte(leaveRequestsTable.endDate, filter.toDate));
    }

    const rows = await this.findRequestRows(where);

    return rows.map((row) => this.mapLeaveRequest(row));
  }

  async leaveBalances(currentUser: AuthenticatedUser, employeeId: string) {
    const scopedEmployeeId = await this.resolveScopedEmployeeId(
      currentUser,
      employeeId,
    );
    const currentYear = new Date().getUTCFullYear();
    const rows = await this.database.drizzle
      .select({
        leaveTypeId: leaveTypesTable.id,
        id: leaveTypesTable.id,
        code: leaveTypesTable.code,
        name: leaveTypesTable.name,
        defaultDays: leaveTypesTable.defaultDays,
        description: leaveTypesTable.description,
        isActive: leaveTypesTable.isActive,
        usedDays: sql<number | null>`(
          SELECT COALESCE(SUM(${leaveRequestsTable.totalDays}), 0)
          FROM ${leaveRequestsTable}
          WHERE ${leaveRequestsTable.leaveTypeId} = ${leaveTypesTable.id}
            AND ${leaveRequestsTable.employeeId} = ${scopedEmployeeId}
            AND ${leaveRequestsTable.status} = 'APPROVED'
            AND DATE_PART('year', ${leaveRequestsTable.startDate}) = ${currentYear}
        )`,
      })
      .from(leaveTypesTable)
      .where(eq(leaveTypesTable.isActive, true))
      .orderBy(asc(leaveTypesTable.name));

    return rows.map((row) => ({
      leaveTypeId: row.leaveTypeId,
      leaveType: this.mapLeaveType(row),
      allocatedDays: row.defaultDays,
      usedDays: Number(row.usedDays ?? 0),
      availableDays: Number((row.defaultDays - Number(row.usedDays ?? 0)).toFixed(2)),
    }));
  }

  private async findLeaveType(id: string) {
    const [row] = await this.database.drizzle
      .select(this.leaveTypeSelectFields())
      .from(leaveTypesTable)
      .where(eq(leaveTypesTable.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Leave type not found');
    }

    return this.mapLeaveType(row);
  }

  private async findRequest(id: string) {
    const [row] = await this.findRequestRows([eq(leaveRequestsTable.id, id)]);

    if (!row) {
      throw new NotFoundException('Leave request not found');
    }

    return this.mapLeaveRequest(row);
  }

  private async resolveScopedEmployeeId(
    currentUser: AuthenticatedUser,
    requestedEmployeeId: string,
  ) {
    const normalizedEmployeeId = requestedEmployeeId.trim();
    if (!normalizedEmployeeId) {
      throw new BadRequestException('Employee is required');
    }
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const [employee] = await this.database.drizzle
      .select({
        id: employees.id,
        departmentId: employees.departmentId,
        supervisorId: employees.supervisorId,
      })
      .from(employees)
      .where(eq(employees.id, normalizedEmployeeId))
      .limit(1);

    if (
      !employee ||
      !canAccessEmployeeWithinScope(scope, {
        employeeId: employee.id,
        departmentId: employee.departmentId,
        supervisorId: employee.supervisorId,
      })
    ) {
      throw new ForbiddenException(
        'This account is not allowed to manage leave for the requested employee',
      );
    }

    return employee.id;
  }

  private leaveTypeSelectFields() {
    return {
      id: leaveTypesTable.id,
      code: leaveTypesTable.code,
      name: leaveTypesTable.name,
      defaultDays: leaveTypesTable.defaultDays,
      description: leaveTypesTable.description,
      isActive: leaveTypesTable.isActive,
    };
  }

  private async findRequestRows(where: SQL[]): Promise<LeaveRequestRow[]> {
    return this.database.drizzle
      .select({
        id: leaveRequestsTable.id,
        employeeId: leaveRequestsTable.employeeId,
        departmentId: employees.departmentId,
        supervisorId: employees.supervisorId,
        leaveTypeId: leaveRequestsTable.leaveTypeId,
        startDate: sql<string>`${leaveRequestsTable.startDate}::text`,
        endDate: sql<string>`${leaveRequestsTable.endDate}::text`,
        totalDays: leaveRequestsTable.totalDays,
        status: leaveRequestsTable.status,
        reason: leaveRequestsTable.reason,
        requestedAt: sql<string>`${leaveRequestsTable.requestedAt}::text`,
        decidedAt: sql<string | null>`${leaveRequestsTable.decidedAt}::text`,
        decisionNotes: leaveRequestsTable.decisionNotes,
        employeeNumber: employees.employeeNumber,
        employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
        leaveTypeCode: leaveTypesTable.code,
        leaveTypeName: leaveTypesTable.name,
        leaveTypeDefaultDays: leaveTypesTable.defaultDays,
        leaveTypeDescription: leaveTypesTable.description,
        leaveTypeIsActive: leaveTypesTable.isActive,
        reviewedByName: sql<string | null>`CASE
          WHEN ${leaveReviewers.id} IS NULL THEN NULL
          ELSE CONCAT(${leaveReviewers.firstName}, ' ', ${leaveReviewers.lastName})
        END`,
      })
      .from(leaveRequestsTable)
      .innerJoin(employees, eq(employees.id, leaveRequestsTable.employeeId))
      .innerJoin(leaveTypesTable, eq(leaveTypesTable.id, leaveRequestsTable.leaveTypeId))
      .leftJoin(leaveReviewers, eq(leaveReviewers.id, leaveRequestsTable.decidedByUserId))
      .where(and(...where))
      .orderBy(desc(leaveRequestsTable.requestedAt), desc(leaveRequestsTable.startDate));
  }

  private buildEmployeeVisibilityCondition(scope: EmployeeVisibilityScope) {
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'department':
        return eq(employees.departmentId, scope.departmentId);
      case 'supervisor':
        return or(
          eq(employees.id, scope.employeeId),
          eq(employees.supervisorId, scope.employeeId),
        );
      case 'self':
        return eq(employees.id, scope.employeeId);
    }
  }

  private assertCanManageLeavePolicies(roles: string[]) {
    const hasAccess = roles.some((role) =>
      ACCOUNT_MANAGER_ROLE_KEYS.includes(role as (typeof ACCOUNT_MANAGER_ROLE_KEYS)[number]),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'Only ADMIN and HR_ADMIN accounts can manage leave policies',
      );
    }
  }

  private assertCanReviewLeaveRequests(roles: string[]) {
    const hasAccess = roles.some((role) =>
      ADMIN_ACCESS_ROLE_KEYS.includes(role as (typeof ADMIN_ACCESS_ROLE_KEYS)[number]),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'Only staff and admin accounts can review leave requests',
      );
    }
  }

  private parseDate(value: string, label: string) {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${label}`);
    }

    return date;
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private calculateTotalDays(startDate: Date, endDate: Date) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const totalDays =
      Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay) + 1;

    return Number(totalDays.toFixed(2));
  }

  private mapLeaveType(row: LeaveTypeRow) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      defaultDays: row.defaultDays,
      description: row.description,
      isActive: row.isActive,
    };
  }

  private mapLeaveRequest(row: LeaveRequestRow) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      leaveTypeId: row.leaveTypeId,
      startDate: row.startDate,
      endDate: row.endDate,
      totalDays: row.totalDays,
      status: row.status,
      reason: row.reason,
      requestedAt: row.requestedAt,
      decidedAt: row.decidedAt,
      reviewedByName: row.reviewedByName,
      decisionNotes: row.decisionNotes,
      employee: {
        id: row.employeeId,
        employeeNumber: row.employeeNumber,
        fullName: row.employeeName,
      },
      leaveType: {
        id: row.leaveTypeId,
        code: row.leaveTypeCode,
        name: row.leaveTypeName,
        defaultDays: row.leaveTypeDefaultDays,
        description: row.leaveTypeDescription,
        isActive: row.leaveTypeIsActive,
      },
    };
  }
}
