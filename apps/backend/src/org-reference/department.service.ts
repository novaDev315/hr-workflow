import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentInput } from '../auth/auth.types';
import { randomUUID } from 'crypto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    return this.prisma.many(
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

    const existing = await this.prisma.one<{ id: string }>(
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

    return this.prisma.one(
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
}
