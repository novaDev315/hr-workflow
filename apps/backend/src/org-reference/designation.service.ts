import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateDesignationInput,
  DeactivateDesignationInput,
  UpdateDesignationInput,
} from '../auth/auth.types';
import { randomUUID } from 'crypto';

@Injectable()
export class DesignationService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(filter?: {
    departmentId?: string;
    includeInactive?: boolean;
  }) {
    const values: unknown[] = [];
    const where: string[] = [];

    if (filter?.departmentId) {
      values.push(filter.departmentId);
      where.push(`d.department_id = $${values.length}`);
    }

    if (!filter?.includeInactive) {
      where.push(`d.is_active = TRUE`);
    }

    const rows = await this.database.many<any>(
      `
        SELECT
          d.id,
          d.title,
          d.code,
          d.department_id AS "departmentId",
          d.level,
          d.description,
          d.is_active AS "isActive",
          dept.id AS "departmentIdValue",
          dept.name AS "departmentName",
          dept.code AS "departmentCode",
          dept.description AS "departmentDescription",
          dept.is_active AS "departmentIsActive"
        FROM designations d
        INNER JOIN departments dept ON dept.id = d.department_id
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY d.level ASC, d.title ASC
      `,
      values,
    );

    return rows.map((row) => this.mapDesignation(row));
  }

  async create(input: CreateDesignationInput) {
    const department = await this.database.one<{ id: string }>(
      `SELECT id FROM departments WHERE id = $1`,
      [input.departmentId],
    );

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const title = input.title.trim();
    const code = input.code.trim().toUpperCase();

    const existing = await this.database.one<{ id: string }>(
      `
        SELECT id
        FROM designations
        WHERE code = $1 OR (department_id = $2 AND title = $3)
      `,
      [code, input.departmentId, title],
    );

    if (existing) {
      throw new ConflictException(
        'Designation with this code or title already exists in the department',
      );
    }

    const created = await this.database.one<{ id: string }>(
      `
        INSERT INTO designations (
          id,
          title,
          code,
          department_id,
          level,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        randomUUID(),
        title,
        code,
        input.departmentId,
        input.level ?? 1,
        input.description?.trim() ?? null,
      ],
    );

    return this.findById(created!.id);
  }

  async update(input: UpdateDesignationInput) {
    const existing = await this.findById(input.id);
    const departmentId = input.departmentId ?? existing.departmentId;
    const title = input.title?.trim() ?? existing.title;
    const code = input.code?.trim().toUpperCase() ?? existing.code;

    const department = await this.database.one<{ id: string }>(
      `SELECT id FROM departments WHERE id = $1 AND is_active = TRUE`,
      [departmentId],
    );

    if (!department) {
      throw new NotFoundException('Department not found or inactive');
    }

    const duplicate = await this.database.one<{ id: string }>(
      `
        SELECT id
        FROM designations
        WHERE (code = $1 OR (department_id = $2 AND title = $3)) AND id <> $4
      `,
      [code, departmentId, title, input.id],
    );

    if (duplicate) {
      throw new ConflictException(
        'Designation with this code or title already exists in the department',
      );
    }

    await this.database.query(
      `
        UPDATE designations
        SET
          title = $2,
          code = $3,
          department_id = $4,
          level = $5,
          description = $6,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        title,
        code,
        departmentId,
        input.level ?? existing.level,
        input.description !== undefined
          ? input.description?.trim() || null
          : existing.description,
      ],
    );

    return this.findById(input.id);
  }

  async deactivate(input: DeactivateDesignationInput) {
    await this.findById(input.id);
    await this.database.query(
      `
        UPDATE designations
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
      `,
      [input.id],
    );

    return this.findById(input.id);
  }

  private async findById(id: string) {
    const row = await this.database.one<any>(
      `
        SELECT
          d.id,
          d.title,
          d.code,
          d.department_id AS "departmentId",
          d.level,
          d.description,
          d.is_active AS "isActive",
          dept.id AS "departmentIdValue",
          dept.name AS "departmentName",
          dept.code AS "departmentCode",
          dept.description AS "departmentDescription",
          dept.is_active AS "departmentIsActive"
        FROM designations d
        INNER JOIN departments dept ON dept.id = d.department_id
        WHERE d.id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Designation not found');
    }

    return this.mapDesignation(row);
  }

  private mapDesignation(row: any) {
    return {
      id: row.id,
      title: row.title,
      code: row.code,
      departmentId: row.departmentId,
      level: row.level,
      description: row.description,
      isActive: row.isActive,
      department: {
        id: row.departmentIdValue,
        name: row.departmentName,
        code: row.departmentCode,
        description: row.departmentDescription,
        isActive: row.departmentIsActive,
      },
    };
  }
}
