import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, ilike, like, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AuthenticatedUser } from '../common/current-user.decorator';
import {
  assertAdminPanelAccess,
  assertAccountManagerAccess,
  canAccessEmployeeWithinScope,
  EmployeeVisibilityScope,
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { DatabaseService } from '../database/database.service';
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
    const existing = await this.database.one<{ id: string }>(
      `SELECT id FROM employees WHERE email = $1`,
      [normalizedEmail],
    );

    if (existing) {
      throw new ConflictException('Employee with this email already exists');
    }

    const department = await this.database.one<{ id: string }>(
      `SELECT id FROM departments WHERE id = $1 AND is_active = TRUE`,
      [input.departmentId],
    );

    if (!department) {
      throw new BadRequestException('Department not found or inactive');
    }

    const designation = await this.database.one<{ id: string; departmentId: string }>(
      `
        SELECT id, department_id AS "departmentId"
        FROM designations
        WHERE id = $1 AND is_active = TRUE
      `,
      [input.designationId],
    );

    if (!designation) {
      throw new BadRequestException('Designation not found or inactive');
    }

    if (designation.departmentId !== input.departmentId) {
      throw new BadRequestException(
        'Designation must belong to the selected department',
      );
    }

    if (input.supervisorId) {
      const supervisor = await this.database.one<{ id: string }>(
        `SELECT id FROM employees WHERE id = $1`,
        [input.supervisorId],
      );

      if (!supervisor) {
        throw new BadRequestException('Supervisor not found');
      }
    }

    const employeeNumber = await this.generateEmployeeNumber();
    const created = await this.database.one<{ id: string }>(
      `
        INSERT INTO employees (
          id,
          employee_number,
          first_name,
          last_name,
          email,
          phone,
          department_id,
          designation_id,
          supervisor_id,
          employment_type,
          join_date,
          status,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `,
      [
        randomUUID(),
        employeeNumber,
        input.firstName.trim(),
        input.lastName.trim(),
        normalizedEmail,
        input.phone?.trim() ?? null,
        input.departmentId,
        input.designationId,
        input.supervisorId ?? null,
        input.employmentType?.trim().toUpperCase() ?? 'FULL_TIME',
        input.joinDate?.trim() ?? new Date().toISOString().slice(0, 10),
        input.status?.trim().toUpperCase() ?? 'ACTIVE',
        true,
      ],
    );

    return this.findOne(currentUser, created!.id);
  }

  async update(currentUser: AuthenticatedUser, input: UpdateEmployeeInput) {
    assertAccountManagerAccess(currentUser.roles);
    const existing = await this.findRawEmployee(input.id);
    const normalizedEmail =
      input.email !== undefined ? input.email.trim().toLowerCase() : existing.email;
    const departmentId = input.departmentId ?? existing.departmentId;
    const designationId = input.designationId ?? existing.designationId;

    if (normalizedEmail !== existing.email) {
      const duplicate = await this.database.one<{ id: string }>(
        `SELECT id FROM employees WHERE email = $1 AND id <> $2`,
        [normalizedEmail, input.id],
      );

      if (duplicate) {
        throw new ConflictException('Employee with this email already exists');
      }
    }

    await this.assertDepartmentAndDesignation(departmentId, designationId);
    await this.assertSupervisor(input.supervisorId ?? existing.supervisorId, input.id);

    await this.database.query(
      `
        UPDATE employees
        SET
          first_name = $2,
          last_name = $3,
          email = $4,
          phone = $5,
          department_id = $6,
          designation_id = $7,
          supervisor_id = $8,
          employment_type = $9,
          join_date = $10,
          status = $11,
          is_active = CASE WHEN $11 = 'INACTIVE' THEN FALSE ELSE is_active END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        input.firstName?.trim() ?? existing.firstName,
        input.lastName?.trim() ?? existing.lastName,
        normalizedEmail,
        input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
        departmentId,
        designationId,
        input.supervisorId !== undefined ? input.supervisorId || null : existing.supervisorId,
        input.employmentType?.trim().toUpperCase() ?? existing.employmentType,
        input.joinDate?.trim() ?? existing.joinDate,
        input.status?.trim().toUpperCase() ?? existing.status,
      ],
    );

    return this.findOne(currentUser, input.id);
  }

  async deactivate(currentUser: AuthenticatedUser, input: DeactivateEmployeeInput) {
    assertAccountManagerAccess(currentUser.roles);
    await this.findRawEmployee(input.id);
    const exitDate = input.exitDate?.trim() || new Date().toISOString().slice(0, 10);

    await this.database.transaction(async (client) => {
      await this.database.query(
        `
          UPDATE employees
          SET
            status = 'INACTIVE',
            is_active = FALSE,
            exit_date = $2,
            updated_at = NOW()
          WHERE id = $1
        `,
        [input.id, exitDate],
        client,
      );

      await this.database.query(
        `
          UPDATE users
          SET is_active = FALSE, updated_at = NOW()
          WHERE employee_id = $1
        `,
        [input.id],
        client,
      );
    });

    return this.findOne(currentUser, input.id);
  }

  private async findRawEmployee(id: string) {
    const employee = await this.database.one<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      departmentId: string;
      designationId: string;
      supervisorId: string | null;
      employmentType: string;
      joinDate: string;
      status: string;
    }>(
      `
        SELECT
          id,
          first_name AS "firstName",
          last_name AS "lastName",
          email,
          phone,
          department_id AS "departmentId",
          designation_id AS "designationId",
          supervisor_id AS "supervisorId",
          employment_type AS "employmentType",
          join_date::text AS "joinDate",
          status
        FROM employees
        WHERE id = $1
      `,
      [id],
    );

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  private async assertDepartmentAndDesignation(
    departmentId: string,
    designationId: string,
  ) {
    const department = await this.database.one<{ id: string }>(
      `SELECT id FROM departments WHERE id = $1 AND is_active = TRUE`,
      [departmentId],
    );

    if (!department) {
      throw new BadRequestException('Department not found or inactive');
    }

    const designation = await this.database.one<{ id: string; departmentId: string }>(
      `
        SELECT id, department_id AS "departmentId"
        FROM designations
        WHERE id = $1 AND is_active = TRUE
      `,
      [designationId],
    );

    if (!designation) {
      throw new BadRequestException('Designation not found or inactive');
    }

    if (designation.departmentId !== departmentId) {
      throw new BadRequestException(
        'Designation must belong to the selected department',
      );
    }
  }

  private async assertSupervisor(supervisorId: string | null | undefined, employeeId: string) {
    if (!supervisorId) {
      return;
    }

    if (supervisorId === employeeId) {
      throw new BadRequestException('Employee cannot supervise themselves');
    }

    const supervisor = await this.database.one<{ id: string }>(
      `SELECT id FROM employees WHERE id = $1 AND is_active = TRUE`,
      [supervisorId],
    );

    if (!supervisor) {
      throw new BadRequestException('Supervisor not found or inactive');
    }
  }

  private async generateEmployeeNumber() {
    const year = new Date().getFullYear();
    const prefix = `EMP${year}`;
    const [row] = await this.database.drizzle
      .select({ employeeNumber: employees.employeeNumber })
      .from(employees)
      .where(like(employees.employeeNumber, `${prefix}%`))
      .orderBy(desc(employees.employeeNumber))
      .limit(1);

    const nextSequence = row
      ? Number.parseInt(row.employeeNumber.slice(-4), 10) + 1
      : 1;

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
