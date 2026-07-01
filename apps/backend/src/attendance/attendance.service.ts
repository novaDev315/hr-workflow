import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq, gte, lte, or, sql, SQL } from 'drizzle-orm';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  canAccessEmployeeWithinScope,
  EmployeeVisibilityScope,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { DatabaseService } from '../database/database.service';
import {
  attendanceRecords,
  employees,
  locations,
} from '../database/drizzle/schema';
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
    private readonly database: DatabaseService,
    private readonly locationService: LocationService,
  ) {}

  async clockIn(currentUser: AuthenticatedUser, input: ClockInInput) {
    const employeeId = await this.resolveScopedEmployeeId(
      currentUser,
      input.employeeId,
    );
    const today = new Date().toISOString().slice(0, 10);
    const [existing] = await this.database.drizzle
      .select({
        id: attendanceRecords.id,
        clockInAt: sql<string | null>`${attendanceRecords.clockInAt}::text`,
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

    const { location, geofence } = await this.locationService.validateAttendanceContext(
      employeeId,
      input.locationId,
      input.latitude,
      input.longitude,
    );

    const now = new Date();

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
          clockInNotes: input.notes?.trim() ?? null,
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
        clockInNotes: input.notes?.trim() ?? null,
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
    const today = new Date().toISOString().slice(0, 10);
    const [attendance] = await this.database.drizzle
      .select({
        id: attendanceRecords.id,
        locationId: attendanceRecords.locationId,
        clockInAt: sql<string | null>`${attendanceRecords.clockInAt}::text`,
        clockOutAt: sql<string | null>`${attendanceRecords.clockOutAt}::text`,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.employeeId, employeeId),
          eq(attendanceRecords.attendanceDate, today),
        ),
      )
      .limit(1);

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

    await this.database.drizzle
      .update(attendanceRecords)
      .set({
        clockOutAt,
        clockOutLatitude: input.latitude,
        clockOutLongitude: input.longitude,
        clockOutDistance: geofence.distance,
        clockOutPhotoUrl: input.photoUrl?.trim() ?? null,
        clockOutNotes: input.notes?.trim() ?? null,
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
      clockInAt: sql<string | null>`${attendanceRecords.clockInAt}::text`,
      clockOutAt: sql<string | null>`${attendanceRecords.clockOutAt}::text`,
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
