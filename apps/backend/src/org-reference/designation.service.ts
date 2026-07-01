import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
} from '../database/drizzle/schema';
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
    const conditions = [];

    if (filter?.departmentId) {
      conditions.push(eq(designations.departmentId, filter.departmentId));
    }

    if (!filter?.includeInactive) {
      conditions.push(eq(designations.isActive, true));
    }

    const query = this.database.drizzle
      .select(this.designationProjection())
      .from(designations)
      .innerJoin(departments, eq(departments.id, designations.departmentId));

    const rows =
      conditions.length > 0
        ? await query
            .where(and(...conditions))
            .orderBy(asc(designations.level), asc(designations.title))
        : await query.orderBy(asc(designations.level), asc(designations.title));

    return rows.map((row) => this.mapDesignation(row));
  }

  async create(input: CreateDesignationInput) {
    const [department] = await this.database.drizzle
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, input.departmentId))
      .limit(1);

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const title = input.title.trim();
    const code = input.code.trim().toUpperCase();

    const existing = await this.database.drizzle
      .select({ id: designations.id })
      .from(designations)
      .where(
        or(
          eq(designations.code, code),
          and(
            eq(designations.departmentId, input.departmentId),
            eq(designations.title, title),
          ),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        'Designation with this code or title already exists in the department',
      );
    }

    const [created] = await this.database.drizzle
      .insert(designations)
      .values({
        id: randomUUID(),
        title,
        code,
        departmentId: input.departmentId,
        level: input.level ?? 1,
        description: input.description?.trim() ?? null,
      })
      .returning({ id: designations.id });

    return this.findById(created.id);
  }

  async update(input: UpdateDesignationInput) {
    const existing = await this.findById(input.id);
    const departmentId = input.departmentId ?? existing.departmentId;
    const title = input.title?.trim() ?? existing.title;
    const code = input.code?.trim().toUpperCase() ?? existing.code;

    const [department] = await this.database.drizzle
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.isActive, true)))
      .limit(1);

    if (!department) {
      throw new NotFoundException('Department not found or inactive');
    }

    const duplicate = await this.database.drizzle
      .select({ id: designations.id })
      .from(designations)
      .where(
        and(
          or(
            eq(designations.code, code),
            and(
              eq(designations.departmentId, departmentId),
              eq(designations.title, title),
            ),
          ),
          ne(designations.id, input.id),
        ),
      )
      .limit(1);

    if (duplicate.length > 0) {
      throw new ConflictException(
        'Designation with this code or title already exists in the department',
      );
    }

    await this.database.drizzle
      .update(designations)
      .set({
        title,
        code,
        departmentId,
        level: input.level ?? existing.level,
        description:
          input.description !== undefined
            ? input.description?.trim() || null
            : existing.description,
        updatedAt: sql`NOW()`,
      })
      .where(eq(designations.id, input.id));

    return this.findById(input.id);
  }

  async deactivate(input: DeactivateDesignationInput) {
    await this.findById(input.id);
    await this.database.drizzle
      .update(designations)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(designations.id, input.id));

    return this.findById(input.id);
  }

  private async findById(id: string) {
    const [row] = await this.database.drizzle
      .select(this.designationProjection())
      .from(designations)
      .innerJoin(departments, eq(departments.id, designations.departmentId))
      .where(eq(designations.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Designation not found');
    }

    return this.mapDesignation(row);
  }

  private designationProjection() {
    return {
      id: designations.id,
      title: designations.title,
      code: designations.code,
      departmentId: designations.departmentId,
      level: designations.level,
      description: designations.description,
      isActive: designations.isActive,
      departmentIdValue: departments.id,
      departmentName: departments.name,
      departmentCode: departments.code,
      departmentDescription: departments.description,
      departmentIsActive: departments.isActive,
    };
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
