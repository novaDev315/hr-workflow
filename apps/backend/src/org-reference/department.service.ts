import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateDepartmentInput,
  DeactivateDepartmentInput,
  UpdateDepartmentInput,
} from '../auth/auth.types';
import { randomUUID } from 'crypto';

@Injectable()
export class DepartmentService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(includeInactive = false) {
    return this.database.many(
      `
        SELECT
          id,
          name,
          code,
          description,
          is_active AS "isActive"
        FROM departments
        ${includeInactive ? '' : 'WHERE is_active = TRUE'}
        ORDER BY name ASC
      `,
    );
  }

  async create(input: CreateDepartmentInput) {
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();

    const existing = await this.database.one<{ id: string }>(
      `
        SELECT id
        FROM departments
        WHERE name = $1 OR code = $2
      `,
      [name, code],
    );

    if (existing) {
      throw new ConflictException('Department with this name or code already exists');
    }

    return this.database.one(
      `
        INSERT INTO departments (id, name, code, description)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          name,
          code,
          description,
          is_active AS "isActive"
      `,
      [randomUUID(), name, code, input.description?.trim() ?? null],
    );
  }

  async update(input: UpdateDepartmentInput) {
    const existing = await this.findById(input.id);
    const name = input.name?.trim() ?? existing.name;
    const code = input.code?.trim().toUpperCase() ?? existing.code;

    const duplicate = await this.database.one<{ id: string }>(
      `
        SELECT id
        FROM departments
        WHERE (name = $1 OR code = $2) AND id <> $3
      `,
      [name, code, input.id],
    );

    if (duplicate) {
      throw new ConflictException('Department with this name or code already exists');
    }

    const updated = await this.database.one(
      `
        UPDATE departments
        SET
          name = $2,
          code = $3,
          description = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          name,
          code,
          description,
          is_active AS "isActive"
      `,
      [
        input.id,
        name,
        code,
        input.description !== undefined
          ? input.description?.trim() || null
          : existing.description,
      ],
    );

    return updated;
  }

  async deactivate(input: DeactivateDepartmentInput) {
    await this.findById(input.id);
    const updated = await this.database.one(
      `
        UPDATE departments
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          name,
          code,
          description,
          is_active AS "isActive"
      `,
      [input.id],
    );

    return updated;
  }

  private async findById(id: string) {
    const row = await this.database.one<{
      id: string;
      name: string;
      code: string;
      description: string | null;
      isActive: boolean;
    }>(
      `
        SELECT
          id,
          name,
          code,
          description,
          is_active AS "isActive"
        FROM departments
        WHERE id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Department not found');
    }

    return row;
  }
}
