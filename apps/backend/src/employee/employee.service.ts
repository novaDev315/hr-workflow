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
  resolveEmployeeVisibilityScope,
} from '../common/access-control';
import { DatabaseService } from '../database/database.service';
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

@Injectable()
export class EmployeeService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(currentUser: AuthenticatedUser, filter?: EmployeeFilterInput) {
    assertAdminPanelAccess(currentUser.roles);
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const values: unknown[] = [];
    const where: string[] = [];
    const scopeClause = buildEmployeeVisibilityClause(values, scope, {
      employeeId: 'e.id',
      departmentId: 'e.department_id',
      supervisorId: 'e.supervisor_id',
    });

    if (scopeClause) {
      where.push(scopeClause);
    }

    if (filter?.search?.trim()) {
      const search = `%${filter.search.trim().toLowerCase()}%`;
      values.push(search);
      const index = values.length;
      where.push(
        `(
          LOWER(e.first_name) LIKE $${index}
          OR LOWER(e.last_name) LIKE $${index}
          OR LOWER(e.email) LIKE $${index}
          OR LOWER(e.employee_number) LIKE $${index}
        )`,
      );
    }

    if (filter?.departmentId) {
      values.push(filter.departmentId);
      where.push(`e.department_id = $${values.length}`);
    }

    if (filter?.status) {
      values.push(filter.status.trim().toUpperCase());
      where.push(`e.status = $${values.length}`);
    }

    const rows = await this.database.many<EmployeeRow>(
      `
        SELECT
          e.id,
          e.employee_number AS "employeeNumber",
          e.first_name AS "firstName",
          e.last_name AS "lastName",
          e.email,
          e.phone,
          e.department_id AS "departmentId",
          e.designation_id AS "designationId",
          e.supervisor_id AS "supervisorId",
          e.employment_type AS "employmentType",
          e.join_date::text AS "joinDate",
          e.exit_date::text AS "exitDate",
          e.status,
          e.is_active AS "isActive",
          d.name AS "departmentName",
          d.code AS "departmentCode",
          d.description AS "departmentDescription",
          d.is_active AS "departmentIsActive",
          des.title AS "designationTitle",
          des.code AS "designationCode",
          des.level AS "designationLevel",
          des.description AS "designationDescription",
          des.is_active AS "designationIsActive",
          s.first_name AS "supervisorFirstName",
          s.last_name AS "supervisorLastName",
          u.email AS "linkedAccountEmail",
          linked_roles.role_keys AS "linkedAccountRoles"
        FROM employees e
        INNER JOIN departments d ON d.id = e.department_id
        INNER JOIN designations des ON des.id = e.designation_id
        LEFT JOIN employees s ON s.id = e.supervisor_id
        LEFT JOIN users u ON u.employee_id = e.id
        LEFT JOIN LATERAL (
          SELECT ARRAY_AGG(r.key ORDER BY r.name ASC) AS role_keys
          FROM user_role_assignments ura
          INNER JOIN roles r ON r.id = ura.role_id
          WHERE ura.user_id = u.id
        ) linked_roles ON TRUE
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.created_at DESC, e.last_name ASC, e.first_name ASC
      `,
      values,
    );

    return rows.map((row) => this.mapEmployee(row));
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    assertAdminPanelAccess(currentUser.roles);
    const scope = await resolveEmployeeVisibilityScope(this.database, currentUser);
    const row = await this.database.one<EmployeeRow>(
      `
        SELECT
          e.id,
          e.employee_number AS "employeeNumber",
          e.first_name AS "firstName",
          e.last_name AS "lastName",
          e.email,
          e.phone,
          e.department_id AS "departmentId",
          e.designation_id AS "designationId",
          e.supervisor_id AS "supervisorId",
          e.employment_type AS "employmentType",
          e.join_date::text AS "joinDate",
          e.exit_date::text AS "exitDate",
          e.status,
          e.is_active AS "isActive",
          d.name AS "departmentName",
          d.code AS "departmentCode",
          d.description AS "departmentDescription",
          d.is_active AS "departmentIsActive",
          des.title AS "designationTitle",
          des.code AS "designationCode",
          des.level AS "designationLevel",
          des.description AS "designationDescription",
          des.is_active AS "designationIsActive",
          s.first_name AS "supervisorFirstName",
          s.last_name AS "supervisorLastName",
          u.email AS "linkedAccountEmail",
          linked_roles.role_keys AS "linkedAccountRoles"
        FROM employees e
        INNER JOIN departments d ON d.id = e.department_id
        INNER JOIN designations des ON des.id = e.designation_id
        LEFT JOIN employees s ON s.id = e.supervisor_id
        LEFT JOIN users u ON u.employee_id = e.id
        LEFT JOIN LATERAL (
          SELECT ARRAY_AGG(r.key ORDER BY r.name ASC) AS role_keys
          FROM user_role_assignments ura
          INNER JOIN roles r ON r.id = ura.role_id
          WHERE ura.user_id = u.id
        ) linked_roles ON TRUE
        WHERE e.id = $1
      `,
      [id],
    );

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
    const row = await this.database.one<{ employeeNumber: string }>(
      `
        SELECT employee_number AS "employeeNumber"
        FROM employees
        WHERE employee_number LIKE $1
        ORDER BY employee_number DESC
        LIMIT 1
      `,
      [`${prefix}%`],
    );

    const nextSequence = row
      ? Number.parseInt(row.employeeNumber.slice(-4), 10) + 1
      : 1;

    return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
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
