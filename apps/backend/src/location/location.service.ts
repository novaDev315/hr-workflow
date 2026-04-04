import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
    assertAdminPanelAccess,
  assertAccountManagerAccess,
  buildEmployeeVisibilityClause,
  canAccessEmployeeWithinScope,
  hasGlobalAdminAccess,
  hasManagerAccess,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignEmployeeLocationInput,
  CreateLocationInput,
} from './location.types';
import { GeofenceService } from './geofence.service';

interface LocationRow {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  address: string;
  city: string | null;
  state: string | null;
  country: string;
  postalCode: string | null;
  landmark: string | null;
  isActive: boolean;
}

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geofence: GeofenceService,
  ) {}

  async findAll(currentUser: AuthenticatedUser, activeOnly = true) {
    assertAdminPanelAccess(currentUser.roles);
    const scope = await resolveEmployeeVisibilityScope(this.prisma, currentUser);
    const values: unknown[] = [];
    const where: string[] = [];

    if (activeOnly) {
      where.push('l.is_active = TRUE');
    }

    if (!hasGlobalAdminAccess(currentUser.roles)) {
      const scopedValues: unknown[] = [];
      const scopedClause = buildEmployeeVisibilityClause(scopedValues, scope, {
        employeeId: 'e.id',
        departmentId: 'e.department_id',
        supervisorId: 'e.supervisor_id',
      });

      where.push(`
        EXISTS (
          SELECT 1
          FROM employee_location_assignments ela
          INNER JOIN employees e ON e.id = ela.employee_id
          WHERE ela.location_id = l.id
            AND ela.status = 'ACTIVE'
            AND (ela.release_date IS NULL OR ela.release_date >= CURRENT_DATE)
            ${scopedClause ? `AND ${scopedClause}` : ''}
        )
      `);
      values.push(...scopedValues);
    }

    const rows = await this.prisma.many<LocationRow>(
      `
        SELECT
          l.id,
          l.code,
          l.name,
          l.latitude,
          l.longitude,
          l.geofence_radius AS "geofenceRadius",
          l.address,
          l.city,
          l.state,
          l.country,
          l.postal_code AS "postalCode",
          l.landmark,
          l.is_active AS "isActive"
        FROM locations l
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY l.name ASC
      `,
      values,
    );

    return rows.map((row) => this.mapLocation(row));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    assertAdminPanelAccess(currentUser.roles);
    const row = await this.prisma.one<LocationRow>(
      `
        SELECT
          id,
          code,
          name,
          latitude,
          longitude,
          geofence_radius AS "geofenceRadius",
          address,
          city,
          state,
          country,
          postal_code AS "postalCode",
          landmark,
          is_active AS "isActive"
        FROM locations
        WHERE id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    if (!hasGlobalAdminAccess(currentUser.roles)) {
      const rows = await this.findAll(currentUser, false);
      if (!rows.some((location) => location.id === id)) {
        throw new ForbiddenException(
          'This account is not allowed to access the requested location',
        );
      }
    }

    return this.mapLocation(row);
  }

  async create(currentUser: AuthenticatedUser, input: CreateLocationInput) {
    assertAccountManagerAccess(currentUser.roles);
    const code = input.code.trim().toUpperCase();
    const existing = await this.prisma.one<{ id: string }>(
      `SELECT id FROM locations WHERE code = $1`,
      [code],
    );

    if (existing) {
      throw new ConflictException('Location with this code already exists');
    }

    const created = await this.prisma.one<{ id: string }>(
      `
        INSERT INTO locations (
          id,
          code,
          name,
          latitude,
          longitude,
          geofence_radius,
          address,
          city,
          state,
          country,
          postal_code,
          landmark
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        randomUUID(),
        code,
        input.name.trim(),
        input.latitude,
        input.longitude,
        input.geofenceRadius ?? 100,
        input.address.trim(),
        input.city?.trim() ?? null,
        input.state?.trim() ?? null,
        input.country?.trim().toUpperCase() ?? 'AE',
        input.postalCode?.trim() ?? null,
        input.landmark?.trim() ?? null,
      ],
    );

    return this.findOne(currentUser, created!.id);
  }

  async assignEmployee(
    currentUser: AuthenticatedUser,
    input: AssignEmployeeLocationInput,
  ) {
    assertAdminPanelAccess(currentUser.roles);
    if (
      !hasGlobalAdminAccess(currentUser.roles) &&
      !hasManagerAccess(currentUser.roles)
    ) {
      throw new ForbiddenException(
        'Only ADMIN, HR_ADMIN, and MANAGER accounts can assign employee locations',
      );
    }

    await this.assertEmployeeScope(currentUser, input.employeeId);
    await this.ensureEmployeeExists(input.employeeId);
    await this.findOne(currentUser, input.locationId);

    return this.prisma.transaction(async (client) => {
      if (input.isPrimary) {
        await this.prisma.query(
          `
            UPDATE employee_location_assignments
            SET is_primary = FALSE
            WHERE employee_id = $1 AND status = 'ACTIVE'
          `,
          [input.employeeId],
          client,
        );
      }

      const existing = await this.prisma.one<{ id: string }>(
        `
          SELECT id
          FROM employee_location_assignments
          WHERE employee_id = $1
            AND location_id = $2
            AND status = 'ACTIVE'
            AND release_date IS NULL
          LIMIT 1
        `,
        [input.employeeId, input.locationId],
        client,
      );

      if (existing) {
        await this.prisma.query(
          `
            UPDATE employee_location_assignments
            SET is_primary = $2
            WHERE id = $1
          `,
          [existing.id, Boolean(input.isPrimary)],
          client,
        );

        return this.getAssignment(existing.id, client);
      }

      const created = await this.prisma.one<{ id: string }>(
        `
          INSERT INTO employee_location_assignments (
            id,
            employee_id,
            location_id,
            is_primary,
            status
          )
          VALUES ($1, $2, $3, $4, 'ACTIVE')
          RETURNING id
        `,
        [
          randomUUID(),
          input.employeeId,
          input.locationId,
          Boolean(input.isPrimary),
        ],
        client,
      );

      return this.getAssignment(created!.id, client);
    });
  }

  async getEmployeeLocations(
    currentUser: AuthenticatedUser,
    employeeId: string,
  ) {
    await this.assertEmployeeScope(currentUser, employeeId);
    await this.ensureEmployeeExists(employeeId);

    const rows = await this.prisma.many<any>(
      `
        SELECT
          ela.id,
          ela.employee_id AS "employeeId",
          ela.location_id AS "locationId",
          ela.is_primary AS "isPrimary",
          ela.assigned_at::text AS "assignedDate",
          ela.release_date::text AS "releaseDate",
          ela.status,
          l.id AS "location.id",
          l.code AS "location.code",
          l.name AS "location.name",
          l.latitude AS "location.latitude",
          l.longitude AS "location.longitude",
          l.geofence_radius AS "location.geofenceRadius",
          l.address AS "location.address",
          l.city AS "location.city",
          l.state AS "location.state",
          l.country AS "location.country",
          l.postal_code AS "location.postalCode",
          l.landmark AS "location.landmark",
          l.is_active AS "location.isActive"
        FROM employee_location_assignments ela
        INNER JOIN locations l ON l.id = ela.location_id
        WHERE ela.employee_id = $1
          AND ela.status = 'ACTIVE'
          AND (ela.release_date IS NULL OR ela.release_date >= CURRENT_DATE)
        ORDER BY ela.is_primary DESC, ela.assigned_at DESC
      `,
      [employeeId],
    );

    return rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      locationId: row.locationId,
      isPrimary: row.isPrimary,
      assignedDate: row.assignedDate,
      releaseDate: row.releaseDate,
      status: row.status,
      location: {
        id: row['location.id'],
        code: row['location.code'],
        name: row['location.name'],
        latitude: row['location.latitude'],
        longitude: row['location.longitude'],
        geofenceRadius: row['location.geofenceRadius'],
        address: row['location.address'],
        city: row['location.city'],
        state: row['location.state'],
        country: row['location.country'],
        postalCode: row['location.postalCode'],
        landmark: row['location.landmark'],
        isActive: row['location.isActive'],
      },
    }));
  }

  async validateAttendanceContext(
    employeeId: string,
    locationId: string,
    latitude: number,
    longitude: number,
  ) {
    await this.ensureEmployeeExists(employeeId);
    const location = await this.findLocationById(locationId);

    if (!location.isActive) {
      throw new BadRequestException('Selected location is inactive');
    }

    const assignment = await this.prisma.one<{ id: string }>(
      `
        SELECT id
        FROM employee_location_assignments
        WHERE employee_id = $1
          AND location_id = $2
          AND status = 'ACTIVE'
          AND (release_date IS NULL OR release_date >= CURRENT_DATE)
        ORDER BY is_primary DESC, assigned_at DESC
        LIMIT 1
      `,
      [employeeId, locationId],
    );

    if (!assignment) {
      throw new ForbiddenException(
        'Employee is not assigned to the selected location',
      );
    }

    const geofence = this.geofence.getGeofenceStatus(
      latitude,
      longitude,
      location.latitude,
      location.longitude,
      location.geofenceRadius,
    );

    if (!geofence.isWithinGeofence) {
      throw new BadRequestException(
        `Outside geofence by ${geofence.distanceFromBoundary} meters`,
      );
    }

    return {
      location,
      geofence,
    };
  }

  private async findLocationById(id: string) {
    const row = await this.prisma.one<LocationRow>(
      `
        SELECT
          id,
          code,
          name,
          latitude,
          longitude,
          geofence_radius AS "geofenceRadius",
          address,
          city,
          state,
          country,
          postal_code AS "postalCode",
          landmark,
          is_active AS "isActive"
        FROM locations
        WHERE id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return this.mapLocation(row);
  }

  private async getAssignment(id: string, client?: any) {
    const row = await this.prisma.one<any>(
      `
        SELECT
          ela.id,
          ela.employee_id AS "employeeId",
          ela.location_id AS "locationId",
          ela.is_primary AS "isPrimary",
          ela.assigned_at::text AS "assignedDate",
          ela.release_date::text AS "releaseDate",
          ela.status,
          l.id AS "location.id",
          l.code AS "location.code",
          l.name AS "location.name",
          l.latitude AS "location.latitude",
          l.longitude AS "location.longitude",
          l.geofence_radius AS "location.geofenceRadius",
          l.address AS "location.address",
          l.city AS "location.city",
          l.state AS "location.state",
          l.country AS "location.country",
          l.postal_code AS "location.postalCode",
          l.landmark AS "location.landmark",
          l.is_active AS "location.isActive"
        FROM employee_location_assignments ela
        INNER JOIN locations l ON l.id = ela.location_id
        WHERE ela.id = $1
      `,
      [id],
      client,
    );

    if (!row) {
      throw new NotFoundException('Assignment not found');
    }

    return {
      id: row.id,
      employeeId: row.employeeId,
      locationId: row.locationId,
      isPrimary: row.isPrimary,
      assignedDate: row.assignedDate,
      releaseDate: row.releaseDate,
      status: row.status,
      location: {
        id: row['location.id'],
        code: row['location.code'],
        name: row['location.name'],
        latitude: row['location.latitude'],
        longitude: row['location.longitude'],
        geofenceRadius: row['location.geofenceRadius'],
        address: row['location.address'],
        city: row['location.city'],
        state: row['location.state'],
        country: row['location.country'],
        postalCode: row['location.postalCode'],
        landmark: row['location.landmark'],
        isActive: row['location.isActive'],
      },
    };
  }

  private async ensureEmployeeExists(employeeId: string) {
    const employee = await this.prisma.one<{ id: string }>(
      `SELECT id FROM employees WHERE id = $1 AND is_active = TRUE`,
      [employeeId],
    );

    if (!employee) {
      throw new NotFoundException('Employee not found or inactive');
    }
  }

  private async assertEmployeeScope(
    currentUser: AuthenticatedUser,
    employeeId: string,
  ) {
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
      [employeeId],
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
        'This account is not allowed to access location assignments for the requested employee',
      );
    }
  }

  private mapLocation(row: LocationRow) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      geofenceRadius: row.geofenceRadius,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postalCode,
      landmark: row.landmark,
      isActive: row.isActive,
    };
  }
}
