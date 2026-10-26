import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, ilike, ne, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  assertAdminPanelAccess,
  assertAccountManagerAccess,
  canAccessEmployeeWithinScope,
  EmployeeVisibilityScope,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { AppDrizzleDatabase, DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
  employees,
  roles,
  userRoleAssignments,
  users,
} from '../database/drizzle/schema';
import {
  CreateEmployeeInput,
  DeactivateEmployeeInput,
  EmployeeFilterInput,
  UpdateEmployeeInput,
} from './employee.types';
import { findUniqueViolation } from './unique-violation';

interface EmployeeRow {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  departmentId: string;
  designationId: string;
  supervisorId: string | null;
  employmentType: string;
  joinDate: string;
  exitDate: string | null;
  status: string;
  isActive: boolean;
  departmentName: string;
  departmentCode: string;
  departmentDescription: string | null;
  departmentIsActive: boolean;
  designationTitle: string;
  designationCode: string;
  designationLevel: number;
  designationDescription: string | null;
  designationIsActive: boolean;
  supervisorFirstName: string | null;
  supervisorLastName: string | null;
  linkedAccountEmail: string | null;
  linkedAccountRoles: string[] | null;
}

const employeeSupervisors = alias(employees, 'employee_supervisors');
const EMPLOYEE_NUMBER_ATTEMPTS = 3;

@Injectable()
export class EmployeeService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(currentUser: AuthenticatedUser, filter?: EmployeeFilterInput) {
    assertAdminPanelAccess(currentUser.roles);
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const where: SQL[] = [];
    const scopeCondition = this.buildVisibilityCondition(scope);

    if (scopeCondition) {
      where.push(scopeCondition);
    }

    if (filter?.search?.trim()) {
      const search = `%${filter.search.trim()}%`;
      const searchCondition = or(
        ilike(employees.firstName, search),
        ilike(employees.lastName, search),
        ilike(employees.email, search),
        ilike(employees.employeeNumber, search),
      );
      if (searchCondition) {
        where.push(searchCondition);
      }
    }

    if (filter?.departmentId) {
      where.push(eq(employees.departmentId, filter.departmentId));
    }

    if (filter?.status) {
      where.push(eq(employees.status, filter.status.trim().toUpperCase()));
    }

    const rows = await this.findEmployeeRows(where);

    return rows.map((row) => this.mapEmployee(row));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    assertAdminPanelAccess(currentUser.roles);
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const [row] = await this.findEmployeeRows([eq(employees.id, id)]);

    if (!row) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    if (
      !canAccessEmployeeWithinScope(scope, {
        employeeId: row.id,
        departmentId: row.departmentId,
        supervisorId: row.supervisorId,
      })
    ) {
      throw new ForbiddenException(
        'This account is not allowed to access the requested employee record',
      );
    }

    return this.mapEmployee(row);
  }

  async create(currentUser: AuthenticatedUser, input: CreateEmployeeInput) {
    assertAccountManagerAccess(currentUser.roles);
    const normalizedEmail = input.email.trim().toLowerCase();
    const [existing] = await this.database.drizzle
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.email, normalizedEmail))
      .limit(1);

    if (existing) {
      throw new ConflictException('Employee with this email already exists');
    }

    await this.assertEmailFreeOfOtherAccounts(normalizedEmail, null);

    const [department] = await this.database.drizzle
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, input.departmentId), eq(departments.isActive, true)))
      .limit(1);

    if (!department) {
      throw new BadRequestException('Department not found or inactive');
    }

    const [designation] = await this.database.drizzle
      .select({
        id: designations.id,
        departmentId: designations.departmentId,
      })
      .from(designations)
      .where(
        and(
          eq(designations.id, input.designationId),
          eq(designations.isActive, true),
        ),
      )
      .limit(1);

    if (!designation) {
      throw new BadRequestException('Designation not found or inactive');
    }

    if (designation.departmentId !== input.departmentId) {
      throw new BadRequestException(
        'Designation must belong to the selected department',
      );
    }

    if (input.supervisorId) {
      const [supervisor] = await this.database.drizzle
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, input.supervisorId))
        .limit(1);

      if (!supervisor) {
        throw new BadRequestException('Supervisor not found');
      }
    }

    let created: { id: string } | undefined;
    for (let attempt = 1; attempt <= EMPLOYEE_NUMBER_ATTEMPTS && !created; attempt += 1) {
      const employeeNumber = await this.generateEmployeeNumber();
      try {
        [created] = await this.database.drizzle
          .insert(employees)
          .values({
            id: randomUUID(),
            employeeNumber,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            email: normalizedEmail,
            phone: input.phone?.trim() ?? null,
            departmentId: input.departmentId,
            designationId: input.designationId,
            supervisorId: input.supervisorId ?? null,
            employmentType: input.employmentType?.trim().toUpperCase() ?? 'FULL_TIME',
            joinDate: input.joinDate?.trim() ?? new Date().toISOString().slice(0, 10),
            status: input.status?.trim().toUpperCase() ?? 'ACTIVE',
            isActive: true,
          })
          .returning({ id: employees.id });
      } catch (error) {
        const violation = findUniqueViolation(error);
        if (!violation) {
          throw error;
        }
        if (violation.constraint.includes('email')) {
          throw new ConflictException('Employee with this email already exists');
        }
        if (!violation.constraint.includes('employee_number')) {
          throw new ConflictException('An employee with these details already exists');
        }
        if (attempt === EMPLOYEE_NUMBER_ATTEMPTS) {
          throw new ConflictException(
            'Could not allocate a unique employee number, please try again',
          );
        }
      }
    }

    if (!created) {
      throw new ConflictException(
        'Could not allocate a unique employee number, please try again',
      );
    }

    return this.findOne(currentUser, created.id);
  }

  /**
   * A work email must not be another person's sign-in: reject it when a user
   * account with that email (case-insensitive) is not linked to this employee.
   */
  private async assertEmailFreeOfOtherAccounts(email: string, employeeId: string | null) {
    const [account] = await this.database.drizzle
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          sql`LOWER(${users.email}) = LOWER(${email})`,
          employeeId
            ? sql`${users.employeeId} IS DISTINCT FROM ${employeeId}`
            : undefined,
        ),
      )
      .limit(1);

    if (account) {
      throw new ConflictException(
        'This email is already used by another sign-in account. Use a different work email.',
      );
    }
  }

  async update(currentUser: AuthenticatedUser, input: UpdateEmployeeInput) {
    assertAccountManagerAccess(currentUser.roles);
    const existing = await this.findRawEmployee(input.id);
    const normalizedEmail =
      input.email !== undefined ? input.email.trim().toLowerCase() : existing.email;
    const departmentId = input.departmentId ?? existing.departmentId;
    const designationId = input.designationId ?? existing.designationId;

    if (normalizedEmail !== existing.email) {
      const [duplicate] = await this.database.drizzle
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.email, normalizedEmail), ne(employees.id, input.id)))
        .limit(1);

      if (duplicate) {
        throw new ConflictException('Employee with this email already exists');
      }

      await this.assertEmailFreeOfOtherAccounts(normalizedEmail, input.id);
    }

    await this.assertDepartmentAndDesignation(departmentId, designationId);

    const supervisorChanged =
      input.supervisorId !== undefined &&
      (input.supervisorId || null) !== existing.supervisorId;
    const status = input.status?.trim().toUpperCase() ?? existing.status;
    const deactivating = status === 'INACTIVE';
    const reactivating =
      !deactivating && input.status !== undefined && !existing.isActive;
    const today = new Date().toISOString().slice(0, 10);

    try {
      await this.database.drizzle.transaction(async (tx) => {
        if (supervisorChanged) {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext('employee:hierarchy'))`,
          );
          await this.assertSupervisor(tx, input.supervisorId, input.id);
        }

        await tx
          .update(employees)
          .set({
            firstName: input.firstName?.trim() ?? existing.firstName,
            lastName: input.lastName?.trim() ?? existing.lastName,
            email: normalizedEmail,
            phone:
              input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
            departmentId,
            designationId,
            supervisorId:
              input.supervisorId !== undefined
                ? input.supervisorId || null
                : existing.supervisorId,
            employmentType:
              input.employmentType?.trim().toUpperCase() ?? existing.employmentType,
            joinDate: input.joinDate?.trim() ?? existing.joinDate,
            status,
            isActive: deactivating ? false : reactivating ? true : existing.isActive,
            exitDate: deactivating
              ? existing.exitDate ?? today
              : reactivating
                ? null
                : existing.exitDate,
            updatedAt: sql`NOW()`,
          })
          .where(eq(employees.id, input.id));

        if (deactivating || reactivating) {
          await tx
            .update(users)
            .set({ isActive: reactivating, updatedAt: sql`NOW()` })
            .where(eq(users.employeeId, input.id));
        }
      });
    } catch (error) {
      const violation = findUniqueViolation(error);
      if (violation) {
        throw new ConflictException('Employee with this email already exists');
      }
      throw error;
    }

    return this.findOne(currentUser, input.id);
  }

  async deactivate(currentUser: AuthenticatedUser, input: DeactivateEmployeeInput) {
    assertAccountManagerAccess(currentUser.roles);
    await this.findRawEmployee(input.id);
    const exitDate = this.resolveExitDate(input.exitDate);

    await this.database.drizzle.transaction(async (tx) => {
      await tx
        .update(employees)
        .set({
          status: 'INACTIVE',
          isActive: false,
          exitDate,
          updatedAt: sql`NOW()`,
        })
        .where(eq(employees.id, input.id));

      await tx
        .update(users)
        .set({ isActive: false, updatedAt: sql`NOW()` })
        .where(eq(users.employeeId, input.id));
    });

    return this.findOne(currentUser, input.id);
  }

  private async findRawEmployee(id: string) {
    const [employee] = await this.database.drizzle
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        phone: employees.phone,
        departmentId: employees.departmentId,
        designationId: employees.designationId,
        supervisorId: employees.supervisorId,
        employmentType: employees.employmentType,
        joinDate: sql<string>`${employees.joinDate}::text`,
        exitDate: sql<string | null>`${employees.exitDate}::text`,
        status: employees.status,
        isActive: employees.isActive,
      })
      .from(employees)
      .where(eq(employees.id, id))
      .limit(1);

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  private async assertDepartmentAndDesignation(
    departmentId: string,
    designationId: string,
  ) {
    const [department] = await this.database.drizzle
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.isActive, true)))
      .limit(1);

    if (!department) {
      throw new BadRequestException('Department not found or inactive');
    }

    const [designation] = await this.database.drizzle
      .select({
        id: designations.id,
        departmentId: designations.departmentId,
      })
      .from(designations)
      .where(
        and(eq(designations.id, designationId), eq(designations.isActive, true)),
      )
      .limit(1);

    if (!designation) {
      throw new BadRequestException('Designation not found or inactive');
    }

    if (designation.departmentId !== departmentId) {
      throw new BadRequestException(
        'Designation must belong to the selected department',
      );
    }
  }

  private resolveExitDate(value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return new Date().toISOString().slice(0, 10);
    }

    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== trimmed
    ) {
      throw new BadRequestException('Exit date must be a valid YYYY-MM-DD date');
    }

    return trimmed;
  }

  private async assertSupervisor(
    executor: Pick<AppDrizzleDatabase, 'select' | 'execute'>,
    supervisorId: string | null | undefined,
    employeeId: string,
  ) {
    if (!supervisorId) {
      return;
    }

    if (supervisorId === employeeId) {
      throw new BadRequestException('Employee cannot supervise themselves');
    }

    const [supervisor] = await executor
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, supervisorId), eq(employees.isActive, true)))
      .limit(1);

    if (!supervisor) {
      throw new BadRequestException('Supervisor not found or inactive');
    }

    // Walk up the proposed supervisor's reporting chain; reaching the employee
    // means the new assignment would create a cycle. UNION (not UNION ALL)
    // also terminates on any pre-existing cycle.
    const cycle = await executor.execute(sql`
      WITH RECURSIVE chain(id, supervisor_id) AS (
        SELECT id, supervisor_id FROM employees WHERE id = ${supervisorId}
        UNION
        SELECT e.id, e.supervisor_id
        FROM employees e
        INNER JOIN chain c ON e.id = c.supervisor_id
      )
      SELECT 1 AS found FROM chain WHERE id = ${employeeId} LIMIT 1
    `);

    if (cycle.rows.length > 0) {
      throw new BadRequestException(
        'This supervisor assignment would create a reporting cycle',
      );
    }
  }

  private async generateEmployeeNumber() {
    const year = new Date().getFullYear();
    const prefix = `EMP${year}`;
    const result = await this.database.drizzle.execute<{ next: string }>(sql`
      SELECT (COALESCE(MAX(SUBSTRING(employee_number FROM ${`^${prefix}([0-9]+)$`})::bigint), 0) + 1)::text AS next
      FROM employees
      WHERE employee_number ~ ${`^${prefix}[0-9]+$`}
    `);
    const nextSequence = Number(result.rows[0]?.next ?? 1);

    return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
  }

  private async findEmployeeRows(where: SQL[]) {
    return this.database.drizzle
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        phone: employees.phone,
        departmentId: employees.departmentId,
        designationId: employees.designationId,
        supervisorId: employees.supervisorId,
        employmentType: employees.employmentType,
        joinDate: employees.joinDate,
        exitDate: employees.exitDate,
        status: employees.status,
        isActive: employees.isActive,
        departmentName: departments.name,
        departmentCode: departments.code,
        departmentDescription: departments.description,
        departmentIsActive: departments.isActive,
        designationTitle: designations.title,
        designationCode: designations.code,
        designationLevel: designations.level,
        designationDescription: designations.description,
        designationIsActive: designations.isActive,
        supervisorFirstName: employeeSupervisors.firstName,
        supervisorLastName: employeeSupervisors.lastName,
        linkedAccountEmail: users.email,
        linkedAccountRoles: sql<string[] | null>`(
          SELECT ARRAY_AGG(${roles.key} ORDER BY ${roles.name} ASC)
          FROM ${userRoleAssignments}
          INNER JOIN ${roles} ON ${roles.id} = ${userRoleAssignments.roleId}
          WHERE ${userRoleAssignments.userId} = ${users.id}
        )`,
      })
      .from(employees)
      .innerJoin(departments, eq(departments.id, employees.departmentId))
      .innerJoin(designations, eq(designations.id, employees.designationId))
      .leftJoin(
        employeeSupervisors,
        eq(employeeSupervisors.id, employees.supervisorId),
      )
      .leftJoin(users, eq(users.employeeId, employees.id))
      .where(and(...where))
      .orderBy(
        desc(employees.createdAt),
        asc(employees.lastName),
        asc(employees.firstName),
      );
  }

  private buildVisibilityCondition(scope: EmployeeVisibilityScope) {
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

  private mapEmployee(row: EmployeeRow) {
    return {
      id: row.id,
      employeeNumber: row.employeeNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email,
      phone: row.phone,
      departmentId: row.departmentId,
      designationId: row.designationId,
      supervisorId: row.supervisorId,
      supervisorName:
        row.supervisorFirstName && row.supervisorLastName
          ? `${row.supervisorFirstName} ${row.supervisorLastName}`.trim()
          : null,
      employmentType: row.employmentType,
      joinDate: row.joinDate,
      exitDate: row.exitDate,
      status: row.status,
      isActive: row.isActive,
      hasLinkedAccount: Boolean(row.linkedAccountEmail),
      linkedAccountEmail: row.linkedAccountEmail,
      linkedAccountRoles: row.linkedAccountRoles ?? [],
      department: {
        id: row.departmentId,
        name: row.departmentName,
        code: row.departmentCode,
        description: row.departmentDescription,
        isActive: row.departmentIsActive,
      },
      designation: {
        id: row.designationId,
        title: row.designationTitle,
        code: row.designationCode,
        departmentId: row.departmentId,
        level: row.designationLevel,
        description: row.designationDescription,
        isActive: row.designationIsActive,
        department: {
          id: row.departmentId,
          name: row.departmentName,
          code: row.departmentCode,
          description: row.departmentDescription,
          isActive: row.departmentIsActive,
        },
      },
    };
  }
}
