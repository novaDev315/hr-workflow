import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  ACCOUNT_MANAGER_ROLE_KEYS,
  ADMIN_ACCESS_ROLE_KEYS,
} from '../common/system-roles';
import {
  buildEmployeeVisibilityClause,
  canAccessEmployeeWithinScope,
  hasGlobalAdminAccess,
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

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async leaveTypes() {
    const rows = await this.prisma.many<LeaveTypeRow>(
      `
        SELECT
          id,
          code,
          name,
          default_days AS "defaultDays",
          description,
          is_active AS "isActive"
        FROM leave_types
        WHERE is_active = TRUE
        ORDER BY name ASC
      `,
    );

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

    const existing = await this.prisma.one<{ id: string }>(
      `SELECT id FROM leave_types WHERE code = $1 OR LOWER(name) = LOWER($2)`,
      [code, name],
    );

    if (existing) {
      throw new ConflictException('A leave type with this code or name already exists');
    }

    const created = await this.prisma.one<{ id: string }>(
      `
        INSERT INTO leave_types (
          id,
          code,
          name,
          default_days,
          description,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING id
      `,
      [
        randomUUID(),
        code,
        name,
        defaultDays,
        input.description?.trim() ?? null,
      ],
    );

    return this.findLeaveType(created!.id);
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

    const duplicate = await this.prisma.one<{ id: string }>(
      `
        SELECT id
        FROM leave_types
        WHERE (code = $1 OR LOWER(name) = LOWER($2)) AND id <> $3
      `,
      [code, name, input.id],
    );

    if (duplicate) {
      throw new ConflictException('A leave type with this code or name already exists');
    }

    await this.prisma.query(
      `
        UPDATE leave_types
        SET
          code = $2,
          name = $3,
          default_days = $4,
          description = $5,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        code,
        name,
        defaultDays,
        input.description !== undefined
          ? input.description?.trim() || null
          : existing.description,
      ],
    );

    return this.findLeaveType(input.id);
  }

  async deactivateLeaveType(
    currentUser: AuthenticatedUser,
    input: DeactivateLeaveTypeInput,
  ) {
    this.assertCanManageLeavePolicies(currentUser.roles);
    await this.findLeaveType(input.id);

    await this.prisma.query(
      `
        UPDATE leave_types
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
      `,
      [input.id],
    );

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

    const leaveType = await this.prisma.one<LeaveTypeRow>(
      `
        SELECT
          id,
          code,
          name,
          default_days AS "defaultDays",
          description,
          is_active AS "isActive"
        FROM leave_types
        WHERE id = $1 AND is_active = TRUE
      `,
      [input.leaveTypeId],
    );

    if (!leaveType) {
      throw new NotFoundException('Leave type not found or inactive');
    }

    const employee = await this.prisma.one<{ id: string }>(
      `SELECT id FROM employees WHERE id = $1 AND is_active = TRUE`,
      [employeeId],
    );

    if (!employee) {
      throw new NotFoundException('Employee not found or inactive');
    }

    const overlapping = await this.prisma.one<{ id: string }>(
      `
        SELECT id
        FROM leave_requests
        WHERE employee_id = $1
          AND status IN ('PENDING', 'APPROVED')
          AND daterange(start_date, end_date, '[]')
            && daterange($2::date, $3::date, '[]')
        LIMIT 1
      `,
      [employeeId, this.formatDate(startDate), this.formatDate(endDate)],
    );

    if (overlapping) {
      throw new ConflictException(
        'This leave request overlaps with an existing pending or approved request',
      );
    }

    const totalDays = this.calculateTotalDays(startDate, endDate);
    const created = await this.prisma.one<{ id: string }>(
      `
        INSERT INTO leave_requests (
          id,
          employee_id,
          leave_type_id,
          start_date,
          end_date,
          total_days,
          reason,
          status,
          requested_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW())
        RETURNING id
      `,
      [
        randomUUID(),
        employeeId,
        input.leaveTypeId,
        this.formatDate(startDate),
        this.formatDate(endDate),
        totalDays,
        input.reason.trim(),
      ],
    );

    return this.findRequest(created!.id);
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

    const existing = await this.prisma.one<{
      id: string;
      status: string;
      employeeId: string;
      departmentId: string | null;
      supervisorId: string | null;
    }>(
      `
        SELECT
          lr.id,
          lr.status,
          lr.employee_id AS "employeeId",
          e.department_id AS "departmentId",
          e.supervisor_id AS "supervisorId"
        FROM leave_requests lr
        INNER JOIN employees e ON e.id = lr.employee_id
        WHERE lr.id = $1
      `,
      [input.requestId],
    );

    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }

    if (existing.status !== 'PENDING') {
      throw new BadRequestException('Only pending leave requests can be reviewed');
    }

    const scope = await resolveEmployeeVisibilityScope(this.prisma, currentUser);
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

    await this.prisma.query(
      `
        UPDATE leave_requests
        SET
          status = $2,
          decision_notes = $3,
          decided_by_user_id = $4,
          decided_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.requestId,
        status,
        input.decisionNotes?.trim() ?? null,
        currentUser.userId,
      ],
    );

    return this.findRequest(input.requestId);
  }

  async leaveRequests(
    currentUser: AuthenticatedUser,
    filter?: LeaveRequestFilterInput,
  ) {
    const scope = await resolveEmployeeVisibilityScope(this.prisma, currentUser);
    const values: unknown[] = [];
    const where: string[] = [];

    const visibilityClause = buildEmployeeVisibilityClause(values, scope, {
      employeeId: 'e.id',
      departmentId: 'e.department_id',
      supervisorId: 'e.supervisor_id',
    });

    if (visibilityClause) {
      where.push(visibilityClause);
    }

    if (filter?.employeeId?.trim()) {
      const scopedEmployeeId = await this.resolveScopedEmployeeId(
        currentUser,
        filter.employeeId,
      );
      values.push(scopedEmployeeId);
      where.push(`lr.employee_id = $${values.length}`);
    }

    if (filter?.status) {
      values.push(filter.status.trim().toUpperCase());
      where.push(`lr.status = $${values.length}`);
    }

    if (filter?.fromDate) {
      values.push(filter.fromDate);
      where.push(`lr.start_date >= $${values.length}`);
    }

    if (filter?.toDate) {
      values.push(filter.toDate);
      where.push(`lr.end_date <= $${values.length}`);
    }

    const rows = await this.prisma.many<LeaveRequestRow>(
      `
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          e.department_id AS "departmentId",
          e.supervisor_id AS "supervisorId",
          lr.leave_type_id AS "leaveTypeId",
          lr.start_date::text AS "startDate",
          lr.end_date::text AS "endDate",
          lr.total_days AS "totalDays",
          lr.status,
          lr.reason,
          lr.requested_at::text AS "requestedAt",
          lr.decided_at::text AS "decidedAt",
          lr.decision_notes AS "decisionNotes",
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName",
          lt.code AS "leaveTypeCode",
          lt.name AS "leaveTypeName",
          lt.default_days AS "leaveTypeDefaultDays",
          lt.description AS "leaveTypeDescription",
          lt.is_active AS "leaveTypeIsActive",
          CASE
            WHEN reviewer.id IS NULL THEN NULL
            ELSE CONCAT(reviewer.first_name, ' ', reviewer.last_name)
          END AS "reviewedByName"
        FROM leave_requests lr
        INNER JOIN employees e ON e.id = lr.employee_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        LEFT JOIN users reviewer ON reviewer.id = lr.decided_by_user_id
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY lr.requested_at DESC, lr.start_date DESC
      `,
      values,
    );

    return rows.map((row) => this.mapLeaveRequest(row));
  }

  async leaveBalances(currentUser: AuthenticatedUser, employeeId: string) {
    const scopedEmployeeId = await this.resolveScopedEmployeeId(
      currentUser,
      employeeId,
    );
    const currentYear = new Date().getUTCFullYear();
    const rows = await this.prisma.many<LeaveBalanceRow>(
      `
        SELECT
          lt.id AS "leaveTypeId",
          lt.id,
          lt.code,
          lt.name,
          lt.default_days AS "defaultDays",
          lt.description,
          lt.is_active AS "isActive",
          usage.used_days AS "usedDays"
        FROM leave_types lt
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(lr.total_days), 0) AS used_days
          FROM leave_requests lr
          WHERE lr.leave_type_id = lt.id
            AND lr.employee_id = $1
            AND lr.status = 'APPROVED'
            AND DATE_PART('year', lr.start_date) = $2
        ) usage ON TRUE
        WHERE lt.is_active = TRUE
        ORDER BY lt.name ASC
      `,
      [scopedEmployeeId, currentYear],
    );

    return rows.map((row) => ({
      leaveTypeId: row.leaveTypeId,
      leaveType: this.mapLeaveType(row),
      allocatedDays: row.defaultDays,
      usedDays: Number(row.usedDays ?? 0),
      availableDays: Number((row.defaultDays - Number(row.usedDays ?? 0)).toFixed(2)),
    }));
  }

  private async findLeaveType(id: string) {
    const row = await this.prisma.one<LeaveTypeRow>(
      `
        SELECT
          id,
          code,
          name,
          default_days AS "defaultDays",
          description,
          is_active AS "isActive"
        FROM leave_types
        WHERE id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Leave type not found');
    }

    return this.mapLeaveType(row);
  }

  private async findRequest(id: string) {
    const row = await this.prisma.one<LeaveRequestRow>(
      `
        SELECT
          lr.id,
          lr.employee_id AS "employeeId",
          e.department_id AS "departmentId",
          e.supervisor_id AS "supervisorId",
          lr.leave_type_id AS "leaveTypeId",
          lr.start_date::text AS "startDate",
          lr.end_date::text AS "endDate",
          lr.total_days AS "totalDays",
          lr.status,
          lr.reason,
          lr.requested_at::text AS "requestedAt",
          lr.decided_at::text AS "decidedAt",
          lr.decision_notes AS "decisionNotes",
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName",
          lt.code AS "leaveTypeCode",
          lt.name AS "leaveTypeName",
          lt.default_days AS "leaveTypeDefaultDays",
          lt.description AS "leaveTypeDescription",
          lt.is_active AS "leaveTypeIsActive",
          CASE
            WHEN reviewer.id IS NULL THEN NULL
            ELSE CONCAT(reviewer.first_name, ' ', reviewer.last_name)
          END AS "reviewedByName"
        FROM leave_requests lr
        INNER JOIN employees e ON e.id = lr.employee_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        LEFT JOIN users reviewer ON reviewer.id = lr.decided_by_user_id
        WHERE lr.id = $1
      `,
      [id],
    );

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
    const scope = await resolveEmployeeVisibilityScope(this.prisma, currentUser);
    const employee = await this.prisma.one<{
      id: string;
      departmentId: string | null;
      supervisorId: string | null;
    }>(
      `
        SELECT
          id,
          department_id AS "departmentId",
          supervisor_id AS "supervisorId"
        FROM employees
        WHERE id = $1
      `,
      [normalizedEmployeeId],
    );

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
