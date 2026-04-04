import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  buildEmployeeVisibilityClause,
  canAccessEmployeeWithinScope,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { PrismaService } from '../prisma/prisma.service';
import { LocationService } from '../location/location.service';
import {
  AttendanceFilterInput,
  ClockInInput,
  ClockOutInput,
} from './attendance.types';

interface AttendanceRow {
  id: string;
  employeeId: string;
  locationId: string;
  attendanceDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockInDistance: number | null;
  clockOutDistance: number | null;
  totalHours: number | null;
  regularHours: number | null;
  overtimeHours: number | null;
  status: string;
  employeeName: string;
  employeeNumber: string;
  departmentId: string | null;
  supervisorId: string | null;
  locationCode: string;
  locationName: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locationService: LocationService,
  ) {}

  async clockIn(currentUser: AuthenticatedUser, input: ClockInInput) {
    const employeeId = await this.resolveScopedEmployeeId(
      currentUser,
      input.employeeId,
    );
    const today = new Date().toISOString().slice(0, 10);
    const existing = await this.prisma.one<{ id: string; clockInAt: string | null }>(
      `
        SELECT id, clock_in_at::text AS "clockInAt"
        FROM attendance_records
        WHERE employee_id = $1 AND attendance_date = $2
      `,
      [employeeId, today],
    );

    if (existing?.clockInAt) {
      throw new BadRequestException('Employee has already clocked in today');
    }

    const { location, geofence } = await this.locationService.validateAttendanceContext(
      employeeId,
      input.locationId,
      input.latitude,
      input.longitude,
    );

    const now = new Date();

    if (existing) {
      await this.prisma.query(
        `
          UPDATE attendance_records
          SET
            location_id = $2,
            clock_in_at = $3,
            clock_in_latitude = $4,
            clock_in_longitude = $5,
            clock_in_distance = $6,
            clock_in_photo_url = $7,
            clock_in_notes = $8,
            clock_in_geofence_valid = TRUE,
            status = 'CLOCKED_IN',
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          existing.id,
          input.locationId,
          now.toISOString(),
          input.latitude,
          input.longitude,
          geofence.distance,
          input.photoUrl?.trim() ?? null,
          input.notes?.trim() ?? null,
        ],
      );

      return this.findOne(currentUser, existing.id);
    }

    const created = await this.prisma.one<{ id: string }>(
      `
        INSERT INTO attendance_records (
          id,
          employee_id,
          location_id,
          attendance_date,
          clock_in_at,
          clock_in_latitude,
          clock_in_longitude,
          clock_in_distance,
          clock_in_photo_url,
          clock_in_notes,
          clock_in_geofence_valid,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 'CLOCKED_IN')
        RETURNING id
      `,
      [
        randomUUID(),
        employeeId,
        location.id,
        today,
        now.toISOString(),
        input.latitude,
        input.longitude,
        geofence.distance,
        input.photoUrl?.trim() ?? null,
        input.notes?.trim() ?? null,
      ],
    );

    return this.findOne(currentUser, created!.id);
  }

  async clockOut(currentUser: AuthenticatedUser, input: ClockOutInput) {
    const employeeId = await this.resolveScopedEmployeeId(
      currentUser,
      input.employeeId,
    );
    const today = new Date().toISOString().slice(0, 10);
    const attendance = await this.prisma.one<{
      id: string;
      locationId: string;
      clockInAt: string | null;
      clockOutAt: string | null;
    }>(
      `
        SELECT
          id,
          location_id AS "locationId",
          clock_in_at::text AS "clockInAt",
          clock_out_at::text AS "clockOutAt"
        FROM attendance_records
        WHERE employee_id = $1 AND attendance_date = $2
      `,
      [employeeId, today],
    );

    if (!attendance) {
      throw new NotFoundException('No attendance record found for today');
    }

    if (!attendance.clockInAt) {
      throw new BadRequestException('Employee must clock in before clocking out');
    }

    if (attendance.clockOutAt) {
      throw new BadRequestException('Employee has already clocked out today');
    }

    const { geofence } = await this.locationService.validateAttendanceContext(
      employeeId,
      attendance.locationId,
      input.latitude,
      input.longitude,
    );

    const clockInAt = new Date(attendance.clockInAt);
    const clockOutAt = new Date();
    const totalMinutes = Math.max(
      0,
      Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60000),
    );
    const totalHours = Number((totalMinutes / 60).toFixed(2));
    const regularHours = Number(Math.min(totalHours, 8).toFixed(2));
    const overtimeHours = Number(Math.max(totalHours - 8, 0).toFixed(2));

    await this.prisma.query(
      `
        UPDATE attendance_records
        SET
          clock_out_at = $2,
          clock_out_latitude = $3,
          clock_out_longitude = $4,
          clock_out_distance = $5,
          clock_out_photo_url = $6,
          clock_out_notes = $7,
          clock_out_geofence_valid = TRUE,
          total_minutes = $8,
          total_hours = $9,
          regular_hours = $10,
          overtime_hours = $11,
          status = 'COMPLETED',
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        attendance.id,
        clockOutAt.toISOString(),
        input.latitude,
        input.longitude,
        geofence.distance,
        input.photoUrl?.trim() ?? null,
        input.notes?.trim() ?? null,
        totalMinutes,
        totalHours,
        regularHours,
        overtimeHours,
      ],
    );

    return this.findOne(currentUser, attendance.id);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    filter?: AttendanceFilterInput,
  ) {
    const values: unknown[] = [];
    const where: string[] = [];
    const scope = await resolveEmployeeVisibilityScope(this.prisma, currentUser);
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
      where.push(`a.employee_id = $${values.length}`);
    }

    if (filter?.locationId) {
      values.push(filter.locationId);
      where.push(`a.location_id = $${values.length}`);
    }

    if (filter?.fromDate) {
      values.push(filter.fromDate);
      where.push(`a.attendance_date >= $${values.length}`);
    }

    if (filter?.toDate) {
      values.push(filter.toDate);
      where.push(`a.attendance_date <= $${values.length}`);
    }

    if (filter?.status) {
      values.push(filter.status.trim().toUpperCase());
      where.push(`a.status = $${values.length}`);
    }

    const rows = await this.prisma.many<AttendanceRow>(
      `
        SELECT
          a.id,
          a.employee_id AS "employeeId",
          a.location_id AS "locationId",
          a.attendance_date::text AS "attendanceDate",
          a.clock_in_at::text AS "clockInAt",
          a.clock_out_at::text AS "clockOutAt",
          a.clock_in_distance AS "clockInDistance",
          a.clock_out_distance AS "clockOutDistance",
          a.total_hours AS "totalHours",
          a.regular_hours AS "regularHours",
          a.overtime_hours AS "overtimeHours",
          a.status,
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName",
          e.department_id AS "departmentId",
          e.supervisor_id AS "supervisorId",
          l.code AS "locationCode",
          l.name AS "locationName"
        FROM attendance_records a
        INNER JOIN employees e ON e.id = a.employee_id
        INNER JOIN locations l ON l.id = a.location_id
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY a.attendance_date DESC, a.clock_in_at DESC NULLS LAST
      `,
      values,
    );

    return rows.map((row) => this.mapAttendance(row));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const row = await this.prisma.one<AttendanceRow>(
      `
        SELECT
          a.id,
          a.employee_id AS "employeeId",
          a.location_id AS "locationId",
          a.attendance_date::text AS "attendanceDate",
          a.clock_in_at::text AS "clockInAt",
          a.clock_out_at::text AS "clockOutAt",
          a.clock_in_distance AS "clockInDistance",
          a.clock_out_distance AS "clockOutDistance",
          a.total_hours AS "totalHours",
          a.regular_hours AS "regularHours",
          a.overtime_hours AS "overtimeHours",
          a.status,
          e.employee_number AS "employeeNumber",
          CONCAT(e.first_name, ' ', e.last_name) AS "employeeName",
          e.department_id AS "departmentId",
          e.supervisor_id AS "supervisorId",
          l.code AS "locationCode",
          l.name AS "locationName"
        FROM attendance_records a
        INNER JOIN employees e ON e.id = a.employee_id
        INNER JOIN locations l ON l.id = a.location_id
        WHERE a.id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }

    const scope = await resolveEmployeeVisibilityScope(this.prisma, currentUser);
    if (
      !canAccessEmployeeWithinScope(scope, {
        employeeId: row.employeeId,
        departmentId: row.departmentId,
        supervisorId: row.supervisorId,
      })
    ) {
      throw new ForbiddenException(
        'This account is not allowed to access attendance for the requested employee',
      );
    }

    return this.mapAttendance(row);
  }

  private async resolveScopedEmployeeId(
    currentUser: AuthenticatedUser,
    employeeId: string,
  ) {
    const normalizedEmployeeId = employeeId.trim();
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
        'This account is not allowed to manage attendance for the requested employee',
      );
    }

    return employee.id;
  }

  private mapAttendance(row: AttendanceRow) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      locationId: row.locationId,
      attendanceDate: row.attendanceDate,
      clockInAt: row.clockInAt,
      clockOutAt: row.clockOutAt,
      clockInDistance: row.clockInDistance,
      clockOutDistance: row.clockOutDistance,
      totalHours: row.totalHours,
      regularHours: row.regularHours,
      overtimeHours: row.overtimeHours,
      status: row.status,
      employee: {
        id: row.employeeId,
        employeeNumber: row.employeeNumber,
        fullName: row.employeeName,
      },
      location: {
        id: row.locationId,
        code: row.locationCode,
        name: row.locationName,
      },
    };
  }
}
