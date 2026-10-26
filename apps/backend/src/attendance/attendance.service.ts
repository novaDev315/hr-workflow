import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq, gte, isNull, lte, or, sql, SQL } from 'drizzle-orm';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  canAccessEmployeeWithinScope,
  EmployeeVisibilityScope,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { DatabaseService } from '../database/database.service';
import {
  attendanceRecords,
  companySettings,
  employees,
  locations,
  users,
} from '../database/drizzle/schema';
import {
  attendanceDateInTimeZone,
  MAX_OPEN_SHIFT_MS,
  resolveTimeZone,
  toIsoTimestamp,
} from './attendance-date';
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
  clockInAt: Date | null;
  clockOutAt: Date | null;
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
    private readonly database: DatabaseService,
    private readonly locationService: LocationService,
  ) {}

  async clockIn(currentUser: AuthenticatedUser, input: ClockInInput) {
    const employeeId = await this.resolveScopedEmployeeId(
      currentUser,
      input.employeeId,
    );
    const now = new Date();
    const today = attendanceDateInTimeZone(now, await this.companyTimeZone());

    const [existing] = await this.database.drizzle
      .select({
        id: attendanceRecords.id,
        clockInAt: attendanceRecords.clockInAt,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employeeId, employeeId),
          eq(attendanceRecords.attendanceDate, today),
        ),
      )
      .limit(1);

    if (existing?.clockInAt) {
      throw new BadRequestException('Employee has already clocked in today');
    }

    // A shift that started before the company-day boundary is still open.
    const [openShift] = await this.database.drizzle
      .select({ id: attendanceRecords.id, clockInAt: attendanceRecords.clockInAt })
      .from(attendanceRecords)
      .where(this.openRecordCondition(employeeId))
      .orderBy(desc(attendanceRecords.clockInAt))
      .limit(1);

    if (
      openShift?.clockInAt &&
      now.getTime() - openShift.clockInAt.getTime() <= MAX_OPEN_SHIFT_MS
    ) {
      throw new BadRequestException(
        'Employee is still clocked in from an earlier shift. Clock out first.',
      );
    }

    const { location, geofence } = await this.locationService.validateAttendanceContext(
      employeeId,
      input.locationId,
      input.latitude,
      input.longitude,
    );

    const notes = await this.composeNotes(currentUser, employeeId, input.notes);

    if (existing) {
      await this.database.drizzle
        .update(attendanceRecords)
        .set({
          locationId: location.id,
          clockInAt: now,
          clockInLatitude: input.latitude,
          clockInLongitude: input.longitude,
          clockInDistance: geofence.distance,
          clockInPhotoUrl: input.photoUrl?.trim() ?? null,
          clockInNotes: notes,
          clockInGeofenceValid: true,
          status: 'CLOCKED_IN',
          updatedAt: sql`NOW()`,
        })
        .where(eq(attendanceRecords.id, existing.id));

      return this.findOne(currentUser, existing.id);
    }

    const [created] = await this.database.drizzle
      .insert(attendanceRecords)
      .values({
        id: randomUUID(),
        employeeId,
        locationId: location.id,
        attendanceDate: today,
        clockInAt: now,
        clockInLatitude: input.latitude,
        clockInLongitude: input.longitude,
        clockInDistance: geofence.distance,
        clockInPhotoUrl: input.photoUrl?.trim() ?? null,
        clockInNotes: notes,
        clockInGeofenceValid: true,
        status: 'CLOCKED_IN',
      })
      .returning({ id: attendanceRecords.id });

    return this.findOne(currentUser, created.id);
  }

  async clockOut(currentUser: AuthenticatedUser, input: ClockOutInput) {
    const employeeId = await this.resolveScopedEmployeeId(
      currentUser,
      input.employeeId,
    );

    // Close the most recent open record regardless of its calendar date, so a
    // shift crossing midnight can still be closed.
    const [attendance] = await this.database.drizzle
      .select({
        id: attendanceRecords.id,
        locationId: attendanceRecords.locationId,
        clockInAt: attendanceRecords.clockInAt,
      })
      .from(attendanceRecords)
      .where(this.openRecordCondition(employeeId))
      .orderBy(desc(attendanceRecords.clockInAt))
      .limit(1);

    if (!attendance || !attendance.clockInAt) {
      const [latest] = await this.database.drizzle
        .select({ status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.employeeId, employeeId),
            eq(
              attendanceRecords.attendanceDate,
              attendanceDateInTimeZone(new Date(), await this.companyTimeZone()),
            ),
          ),
        )
        .limit(1);

      if (latest?.status === 'COMPLETED') {
        throw new BadRequestException('Employee has already clocked out today');
      }

      throw new NotFoundException(
        'No open attendance record found. Employee must clock in before clocking out',
      );
    }

    const clockOutAt = new Date();
    if (clockOutAt.getTime() - attendance.clockInAt.getTime() > MAX_OPEN_SHIFT_MS) {
      throw new BadRequestException(
        `The open attendance record from ${attendance.clockInAt.toISOString()} is older than 24 hours. Ask an admin to correct it before clocking in again.`,
      );
    }

    // Geofence is checked against the record's own location, so a deactivated
    // location or released assignment cannot trap an open shift.
    const { geofence } = await this.locationService.validateRecordedLocationGeofence(
      attendance.locationId,
      input.latitude,
      input.longitude,
    );

    const totalMinutes = Math.max(
      0,
      Math.round((clockOutAt.getTime() - attendance.clockInAt.getTime()) / 60000),
    );
    const totalHours = Number((totalMinutes / 60).toFixed(2));
    const regularHours = Number(Math.min(totalHours, 8).toFixed(2));
    const overtimeHours = Number(Math.max(totalHours - 8, 0).toFixed(2));
    const notes = await this.composeNotes(currentUser, employeeId, input.notes);

    await this.database.drizzle
      .update(attendanceRecords)
      .set({
        clockOutAt,
        clockOutLatitude: input.latitude,
        clockOutLongitude: input.longitude,
        clockOutDistance: geofence.distance,
        clockOutPhotoUrl: input.photoUrl?.trim() ?? null,
        clockOutNotes: notes,
        clockOutGeofenceValid: true,
        totalMinutes,
        totalHours,
        regularHours,
        overtimeHours,
        status: 'COMPLETED',
        updatedAt: sql`NOW()`,
      })
      .where(eq(attendanceRecords.id, attendance.id));

    return this.findOne(currentUser, attendance.id);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    filter?: AttendanceFilterInput,
  ) {
    const where: SQL[] = [];
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const visibilityClause = this.buildEmployeeVisibilityCondition(scope);

    if (visibilityClause) {
      where.push(visibilityClause);
    }

    if (filter?.employeeId?.trim()) {
      const scopedEmployeeId = await this.resolveScopedEmployeeId(
        currentUser,
        filter.employeeId,
      );
      where.push(eq(attendanceRecords.employeeId, scopedEmployeeId));
    }

    if (filter?.locationId) {
      where.push(eq(attendanceRecords.locationId, filter.locationId));
    }

    if (filter?.fromDate) {
      where.push(gte(attendanceRecords.attendanceDate, filter.fromDate));
    }

    if (filter?.toDate) {
      where.push(lte(attendanceRecords.attendanceDate, filter.toDate));
    }

    if (filter?.status) {
      where.push(eq(attendanceRecords.status, filter.status.trim().toUpperCase()));
    }

    const rows = await this.database.drizzle
      .select(this.attendanceSelectFields())
      .from(attendanceRecords)
      .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
      .innerJoin(locations, eq(locations.id, attendanceRecords.locationId))
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(
        desc(attendanceRecords.attendanceDate),
        sql`${attendanceRecords.clockInAt} DESC NULLS LAST`,
      );

    return rows.map((row) => this.mapAttendance(row));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const [row] = await this.database.drizzle
      .select(this.attendanceSelectFields())
      .from(attendanceRecords)
      .innerJoin(employees, eq(employees.id, attendanceRecords.employeeId))
      .innerJoin(locations, eq(locations.id, attendanceRecords.locationId))
      .where(eq(attendanceRecords.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }

    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
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

  private openRecordCondition(employeeId: string) {
    return and(
      eq(attendanceRecords.employeeId, employeeId),
      eq(attendanceRecords.status, 'CLOCKED_IN'),
      isNull(attendanceRecords.clockOutAt),
    );
  }

  private async companyTimeZone() {
    const [row] = await this.database.drizzle
      .select({ timezone: companySettings.timezone })
      .from(companySettings)
      .where(eq(companySettings.singletonKey, 'default'))
      .limit(1);

    return resolveTimeZone(row?.timezone);
  }

  /** Adds "Recorded by <actor>" when someone other than the employee clocks them in or out. */
  private async composeNotes(
    currentUser: AuthenticatedUser,
    employeeId: string,
    notes?: string | null,
  ) {
    const trimmed = notes?.trim() || null;
    const [actor] = await this.database.drizzle
      .select({
        employeeId: users.employeeId,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, currentUser.userId))
      .limit(1);

    if (actor?.employeeId === employeeId) {
      return trimmed;
    }

    const actorName = actor
      ? `${actor.firstName} ${actor.lastName}`.trim()
      : currentUser.email;
    const marker = `Recorded by ${actorName}`;
    return trimmed ? `${trimmed} | ${marker}` : marker;
  }

  private async resolveScopedEmployeeId(
    currentUser: AuthenticatedUser,
    employeeId: string,
  ) {
    const normalizedEmployeeId = employeeId.trim();
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
        'This account is not allowed to manage attendance for the requested employee',
      );
    }

    return employee.id;
  }

  private buildEmployeeVisibilityCondition(scope: EmployeeVisibilityScope) {
    switch (scope.kind) {
      case 'all':
        return undefined;
      case 'department':
        return eq(employees.departmentId, scope.departmentId);
      case 'supervisor':
        return or(
          eq(attendanceRecords.employeeId, scope.employeeId),
          eq(employees.supervisorId, scope.employeeId),
        );
      case 'self':
        return eq(attendanceRecords.employeeId, scope.employeeId);
    }
  }

  private attendanceSelectFields() {
    return {
      id: attendanceRecords.id,
      employeeId: attendanceRecords.employeeId,
      locationId: attendanceRecords.locationId,
      attendanceDate: sql<string>`${attendanceRecords.attendanceDate}::text`,
      clockInAt: attendanceRecords.clockInAt,
      clockOutAt: attendanceRecords.clockOutAt,
      clockInDistance: attendanceRecords.clockInDistance,
      clockOutDistance: attendanceRecords.clockOutDistance,
      totalHours: attendanceRecords.totalHours,
      regularHours: attendanceRecords.regularHours,
      overtimeHours: attendanceRecords.overtimeHours,
      status: attendanceRecords.status,
      employeeNumber: employees.employeeNumber,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
      departmentId: employees.departmentId,
      supervisorId: employees.supervisorId,
      locationCode: locations.code,
      locationName: locations.name,
    };
  }

  private mapAttendance(row: AttendanceRow) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      locationId: row.locationId,
      attendanceDate: row.attendanceDate,
      clockInAt: toIsoTimestamp(row.clockInAt),
      clockOutAt: toIsoTimestamp(row.clockOutAt),
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
