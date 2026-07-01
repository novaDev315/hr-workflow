import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gte, isNull, ne, or, sql, SQL } from 'drizzle-orm';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  assertAdminPanelAccess,
  assertAccountManagerAccess,
  canAccessEmployeeWithinScope,
  EmployeeVisibilityScope,
  hasGlobalAdminAccess,
  hasManagerAccess,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { DatabaseService } from '../database/database.service';
import {
  employeeLocationAssignments,
  employees,
  locations,
} from '../database/drizzle/schema';
import {
  AssignEmployeeLocationInput,
  CreateLocationInput,
  DeactivateLocationInput,
  UpdateLocationInput,
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

interface LocationAssignmentRow {
  id: string;
  employeeId: string;
  locationId: string;
  isPrimary: boolean;
  assignedDate: string;
  releaseDate: string | null;
  status: string;
  locationIdValue: string;
  locationCode: string;
  locationName: string;
  locationLatitude: number;
  locationLongitude: number;
  locationGeofenceRadius: number;
  locationAddress: string;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string;
  locationPostalCode: string | null;
  locationLandmark: string | null;
  locationIsActive: boolean;
}

@Injectable()
export class LocationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly geofence: GeofenceService,
  ) {}

  async findAll(currentUser: AuthenticatedUser, activeOnly = true) {
    assertAdminPanelAccess(currentUser.roles);
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const where: SQL[] = [];

    if (activeOnly) {
      where.push(eq(locations.isActive, true));
    }

    if (!hasGlobalAdminAccess(currentUser.roles)) {
      where.push(this.buildScopedLocationExistsCondition(scope));
    }

    const rows = await this.database.drizzle
      .select(this.locationSelectFields())
      .from(locations)
      .where(and(...where))
      .orderBy(asc(locations.name));

    return rows.map((row) => this.mapLocation(row));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    assertAdminPanelAccess(currentUser.roles);
    const row = await this.findLocationById(id);

    if (!hasGlobalAdminAccess(currentUser.roles)) {
      const rows = await this.findAll(currentUser, false);
      if (!rows.some((location) => location.id === id)) {
        throw new ForbiddenException(
          'This account is not allowed to access the requested location',
        );
      }
    }

    return row;
  }

  async create(currentUser: AuthenticatedUser, input: CreateLocationInput) {
    assertAccountManagerAccess(currentUser.roles);
    const code = input.code.trim().toUpperCase();
    const [existing] = await this.database.drizzle
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.code, code))
      .limit(1);

    if (existing) {
      throw new ConflictException('Location with this code already exists');
    }

    const [created] = await this.database.drizzle
      .insert(locations)
      .values({
        id: randomUUID(),
        code,
        name: input.name.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        geofenceRadius: input.geofenceRadius ?? 100,
        address: input.address.trim(),
        city: input.city?.trim() ?? null,
        state: input.state?.trim() ?? null,
        country: input.country?.trim().toUpperCase() ?? 'AE',
        postalCode: input.postalCode?.trim() ?? null,
        landmark: input.landmark?.trim() ?? null,
      })
      .returning({ id: locations.id });

    return this.findOne(currentUser, created.id);
  }

  async update(currentUser: AuthenticatedUser, input: UpdateLocationInput) {
    assertAccountManagerAccess(currentUser.roles);
    const existing = await this.findLocationById(input.id);
    const code = input.code?.trim().toUpperCase() ?? existing.code;

    if (code !== existing.code) {
      const [duplicate] = await this.database.drizzle
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.code, code), ne(locations.id, input.id)))
        .limit(1);

      if (duplicate) {
        throw new ConflictException('Location with this code already exists');
      }
    }

    await this.database.drizzle
      .update(locations)
      .set({
        code,
        name: input.name?.trim() ?? existing.name,
        latitude: input.latitude ?? existing.latitude,
        longitude: input.longitude ?? existing.longitude,
        geofenceRadius: input.geofenceRadius ?? existing.geofenceRadius,
        address: input.address?.trim() ?? existing.address,
        city: input.city !== undefined ? input.city?.trim() || null : existing.city,
        state: input.state !== undefined ? input.state?.trim() || null : existing.state,
        country: input.country?.trim().toUpperCase() ?? existing.country,
        postalCode:
          input.postalCode !== undefined
            ? input.postalCode?.trim() || null
            : existing.postalCode,
        landmark:
          input.landmark !== undefined
            ? input.landmark?.trim() || null
            : existing.landmark,
        updatedAt: sql`NOW()`,
      })
      .where(eq(locations.id, input.id));

    return this.findOne(currentUser, input.id);
  }

  async deactivate(currentUser: AuthenticatedUser, input: DeactivateLocationInput) {
    assertAccountManagerAccess(currentUser.roles);
    await this.findLocationById(input.id);

    await this.database.drizzle
      .update(locations)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(locations.id, input.id));

    return this.findOne(currentUser, input.id);
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

    return this.database.drizzle.transaction(async (tx) => {
      if (input.isPrimary) {
        await tx
          .update(employeeLocationAssignments)
          .set({ isPrimary: false })
          .where(
            and(
              eq(employeeLocationAssignments.employeeId, input.employeeId),
              eq(employeeLocationAssignments.status, 'ACTIVE'),
            ),
          );
      }

      const [existing] = await tx
        .select({ id: employeeLocationAssignments.id })
        .from(employeeLocationAssignments)
        .where(
          and(
            eq(employeeLocationAssignments.employeeId, input.employeeId),
            eq(employeeLocationAssignments.locationId, input.locationId),
            eq(employeeLocationAssignments.status, 'ACTIVE'),
            isNull(employeeLocationAssignments.releaseDate),
          ),
        )
        .limit(1);

      if (existing) {
        await tx
          .update(employeeLocationAssignments)
          .set({ isPrimary: Boolean(input.isPrimary) })
          .where(eq(employeeLocationAssignments.id, existing.id));

        return this.getAssignment(existing.id, tx);
      }

      const [created] = await tx
        .insert(employeeLocationAssignments)
        .values({
          id: randomUUID(),
          employeeId: input.employeeId,
          locationId: input.locationId,
          isPrimary: Boolean(input.isPrimary),
          status: 'ACTIVE',
        })
        .returning({ id: employeeLocationAssignments.id });

      return this.getAssignment(created.id, tx);
    });
  }

  async getEmployeeLocations(
    currentUser: AuthenticatedUser,
    employeeId: string,
  ) {
    await this.assertEmployeeScope(currentUser, employeeId);
    await this.ensureEmployeeExists(employeeId);

    const rows = await this.findAssignmentRows([
      eq(employeeLocationAssignments.employeeId, employeeId),
      eq(employeeLocationAssignments.status, 'ACTIVE'),
      this.activeAssignmentReleaseCondition(),
    ]);

    return rows.map((row) => this.mapAssignment(row));
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

    const [assignment] = await this.database.drizzle
      .select({ id: employeeLocationAssignments.id })
      .from(employeeLocationAssignments)
      .where(
        and(
          eq(employeeLocationAssignments.employeeId, employeeId),
          eq(employeeLocationAssignments.locationId, locationId),
          eq(employeeLocationAssignments.status, 'ACTIVE'),
          this.activeAssignmentReleaseCondition(),
        ),
      )
      .orderBy(
        desc(employeeLocationAssignments.isPrimary),
        desc(employeeLocationAssignments.assignedAt),
      )
      .limit(1);

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
    const [row] = await this.database.drizzle
      .select(this.locationSelectFields())
      .from(locations)
      .where(eq(locations.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return this.mapLocation(row);
  }

  private async getAssignment(id: string, db: any = this.database.drizzle) {
    const [row] = await this.findAssignmentRows(
      [eq(employeeLocationAssignments.id, id)],
      db,
    );

    if (!row) {
      throw new NotFoundException('Assignment not found');
    }

    return this.mapAssignment(row);
  }

  private async ensureEmployeeExists(employeeId: string) {
    const [employee] = await this.database.drizzle
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
      .limit(1);

    if (!employee) {
      throw new NotFoundException('Employee not found or inactive');
    }
  }

  private async assertEmployeeScope(
    currentUser: AuthenticatedUser,
    employeeId: string,
  ) {
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const [employee] = await this.database.drizzle
      .select({
        id: employees.id,
        departmentId: employees.departmentId,
        supervisorId: employees.supervisorId,
      })
      .from(employees)
      .where(eq(employees.id, employeeId))
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
        'This account is not allowed to access location assignments for the requested employee',
      );
    }
  }

  private locationSelectFields() {
    return {
      id: locations.id,
      code: locations.code,
      name: locations.name,
      latitude: locations.latitude,
      longitude: locations.longitude,
      geofenceRadius: locations.geofenceRadius,
      address: locations.address,
      city: locations.city,
      state: locations.state,
      country: locations.country,
      postalCode: locations.postalCode,
      landmark: locations.landmark,
      isActive: locations.isActive,
    };
  }

  private async findAssignmentRows(
    where: SQL[],
    db: any = this.database.drizzle,
  ): Promise<LocationAssignmentRow[]> {
    return db
      .select({
        id: employeeLocationAssignments.id,
        employeeId: employeeLocationAssignments.employeeId,
        locationId: employeeLocationAssignments.locationId,
        isPrimary: employeeLocationAssignments.isPrimary,
        assignedDate: sql<string>`${employeeLocationAssignments.assignedAt}::text`,
        releaseDate: sql<string | null>`${employeeLocationAssignments.releaseDate}::text`,
        status: employeeLocationAssignments.status,
        locationIdValue: locations.id,
        locationCode: locations.code,
        locationName: locations.name,
        locationLatitude: locations.latitude,
        locationLongitude: locations.longitude,
        locationGeofenceRadius: locations.geofenceRadius,
        locationAddress: locations.address,
        locationCity: locations.city,
        locationState: locations.state,
        locationCountry: locations.country,
        locationPostalCode: locations.postalCode,
        locationLandmark: locations.landmark,
        locationIsActive: locations.isActive,
      })
      .from(employeeLocationAssignments)
      .innerJoin(locations, eq(locations.id, employeeLocationAssignments.locationId))
      .where(and(...where))
      .orderBy(
        desc(employeeLocationAssignments.isPrimary),
        desc(employeeLocationAssignments.assignedAt),
      );
  }

  private activeAssignmentReleaseCondition() {
    return or(
      isNull(employeeLocationAssignments.releaseDate),
      gte(employeeLocationAssignments.releaseDate, sql`CURRENT_DATE`),
    );
  }

  private buildScopedLocationExistsCondition(scope: EmployeeVisibilityScope) {
    const scopeCondition = this.buildEmployeeScopeCondition(scope);
    return sql`EXISTS (
      SELECT 1
      FROM ${employeeLocationAssignments}
      INNER JOIN ${employees}
        ON ${employees.id} = ${employeeLocationAssignments.employeeId}
      WHERE ${employeeLocationAssignments.locationId} = ${locations.id}
        AND ${employeeLocationAssignments.status} = 'ACTIVE'
        AND (
          ${employeeLocationAssignments.releaseDate} IS NULL
          OR ${employeeLocationAssignments.releaseDate} >= CURRENT_DATE
        )
        ${scopeCondition ? sql`AND ${scopeCondition}` : sql``}
    )`;
  }

  private buildEmployeeScopeCondition(scope: EmployeeVisibilityScope) {
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

  private mapAssignment(row: LocationAssignmentRow) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      locationId: row.locationId,
      isPrimary: row.isPrimary,
      assignedDate: row.assignedDate,
      releaseDate: row.releaseDate,
      status: row.status,
      location: {
        id: row.locationIdValue,
        code: row.locationCode,
        name: row.locationName,
        latitude: row.locationLatitude,
        longitude: row.locationLongitude,
        geofenceRadius: row.locationGeofenceRadius,
        address: row.locationAddress,
        city: row.locationCity,
        state: row.locationState,
        country: row.locationCountry,
        postalCode: row.locationPostalCode,
        landmark: row.locationLandmark,
        isActive: row.locationIsActive,
      },
    };
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
