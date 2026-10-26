import { pluralize } from '../common/document-format';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { departments, designations, employees } from '../database/drizzle/schema';
import {
  CreateDepartmentInput,
  DeactivateDepartmentInput,
  UpdateDepartmentInput,
} from '../auth/auth.types';
import { randomUUID } from 'crypto';
import { findUniqueViolation } from './unique-violation';

const DUPLICATE_MESSAGE = 'Department with this name or code already exists';

@Injectable()
export class DepartmentService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(includeInactive = false) {
    const query = this.database.drizzle
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        description: departments.description,
        isActive: departments.isActive,
      })
      .from(departments);

    if (includeInactive) {
      return query.orderBy(departments.name);
    }

    return query
      .where(eq(departments.isActive, true))
      .orderBy(departments.name);
  }

  async create(input: CreateDepartmentInput) {
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();

    const existing = await this.database.drizzle
      .select({ id: departments.id })
      .from(departments)
      .where(or(eq(departments.name, name), eq(departments.code, code)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Department with this name or code already exists');
    }

    try {
      const [created] = await this.database.drizzle
        .insert(departments)
        .values({
          id: randomUUID(),
          name,
          code,
          description: input.description?.trim() ?? null,
        })
        .returning({
          id: departments.id,
          name: departments.name,
          code: departments.code,
          description: departments.description,
          isActive: departments.isActive,
        });

      return created;
    } catch (error) {
      if (findUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async update(input: UpdateDepartmentInput) {
    const existing = await this.findById(input.id);
    const name = input.name?.trim() ?? existing.name;
    const code = input.code?.trim().toUpperCase() ?? existing.code;

    const duplicate = await this.database.drizzle
      .select({ id: departments.id })
      .from(departments)
      .where(
        and(
          or(eq(departments.name, name), eq(departments.code, code)),
          ne(departments.id, input.id),
        ),
      )
      .limit(1);

    if (duplicate.length > 0) {
      throw new ConflictException('Department with this name or code already exists');
    }

    try {
      const [updated] = await this.database.drizzle
        .update(departments)
        .set({
          name,
          code,
          description:
            input.description !== undefined
              ? input.description?.trim() || null
              : existing.description,
          updatedAt: sql`NOW()`,
        })
        .where(eq(departments.id, input.id))
        .returning({
          id: departments.id,
          name: departments.name,
          code: departments.code,
          description: departments.description,
          isActive: departments.isActive,
        });

      return updated;
    } catch (error) {
      if (findUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async deactivate(input: DeactivateDepartmentInput) {
    await this.findById(input.id);
    await this.assertNoActiveDependents(input.id);
    const [updated] = await this.database.drizzle
      .update(departments)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(departments.id, input.id))
      .returning({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        description: departments.description,
        isActive: departments.isActive,
      });

    return updated;
  }

  private async assertNoActiveDependents(departmentId: string) {
    const [employeeCount] = await this.database.drizzle
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(employees)
      .where(and(eq(employees.departmentId, departmentId), eq(employees.isActive, true)));
    const [designationCount] = await this.database.drizzle
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(designations)
      .where(and(eq(designations.departmentId, departmentId), eq(designations.isActive, true)));

    const activeEmployees = Number(employeeCount?.total ?? 0);
    const activeDesignations = Number(designationCount?.total ?? 0);
    if (activeEmployees > 0 || activeDesignations > 0) {
      const parts: string[] = [];
      if (activeEmployees > 0) {
        parts.push(`${pluralize(activeEmployees, 'active employee')}`);
      }
      if (activeDesignations > 0) {
        parts.push(`${pluralize(activeDesignations, 'active designation')}`);
      }
      throw new BadRequestException(
        `Cannot deactivate this department: it still has ${parts.join(' and ')}. Reassign or deactivate them first.`,
      );
    }
  }

  private async findById(id: string) {
    const [row] = await this.database.drizzle
      .select({
        id: departments.id,
        name: departments.name,
        code: departments.code,
        description: departments.description,
        isActive: departments.isActive,
      })
      .from(departments)
      .where(eq(departments.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Department not found');
    }

    return row;
  }
}
