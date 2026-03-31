import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeInput, EmployeeFilterInput } from './employee.types';

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
  userAccountEmail: string | null;
}

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter?: EmployeeFilterInput) {
    const values: unknown[] = [];
    const where: string[] = [];

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

    const rows = await this.prisma.many<EmployeeRow>(
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
          u.email AS "userAccountEmail"
        FROM employees e
        INNER JOIN departments d ON d.id = e.department_id
        INNER JOIN designations des ON des.id = e.designation_id
        LEFT JOIN employees s ON s.id = e.supervisor_id
        LEFT JOIN users u ON u.employee_id = e.id
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY e.created_at DESC, e.last_name ASC, e.first_name ASC
      `,
      values,
    );

    return rows.map((row) => this.mapEmployee(row));
  }

  async findOne(id: string) {
    const row = await this.prisma.one<EmployeeRow>(
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
          u.email AS "userAccountEmail"
        FROM employees e
        INNER JOIN departments d ON d.id = e.department_id
        INNER JOIN designations des ON des.id = e.designation_id
        LEFT JOIN employees s ON s.id = e.supervisor_id
        LEFT JOIN users u ON u.employee_id = e.id
        WHERE e.id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return this.mapEmployee(row);
  }

  async create(input: CreateEmployeeInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.prisma.one<{ id: string }>(
      `SELECT id FROM employees WHERE email = $1`,
      [normalizedEmail],
    );

    if (existing) {
      throw new ConflictException('Employee with this email already exists');
    }

    const department = await this.prisma.one<{ id: string }>(
      `SELECT id FROM departments WHERE id = $1 AND is_active = TRUE`,
      [input.departmentId],
    );

    if (!department) {
      throw new BadRequestException('Department not found or inactive');
    }

    const designation = await this.prisma.one<{ id: string; departmentId: string }>(
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
      const supervisor = await this.prisma.one<{ id: string }>(
        `SELECT id FROM employees WHERE id = $1`,
        [input.supervisorId],
      );

      if (!supervisor) {
        throw new BadRequestException('Supervisor not found');
      }
    }

    const employeeNumber = await this.generateEmployeeNumber();
    const created = await this.prisma.one<{ id: string }>(
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

    return this.findOne(created!.id);
  }

  private async generateEmployeeNumber() {
    const year = new Date().getFullYear();
    const prefix = `EMP${year}`;
    const row = await this.prisma.one<{ employeeNumber: string }>(
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
      hasUserAccount: Boolean(row.userAccountEmail),
      userAccountEmail: row.userAccountEmail,
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
