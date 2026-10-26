import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { and, eq, inArray, like } from 'drizzle-orm';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  departments as departmentsTable,
  designations as designationsTable,
  employees as employeesTable,
  users,
} from '../database/drizzle/schema';
import { EmployeeService } from '../employee/employee.service';
import { DepartmentService } from '../org-reference/department.service';
import { DesignationService } from '../org-reference/designation.service';

jest.setTimeout(60000);

describe('Employee lifecycle and org integrity', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let employeeService: EmployeeService;
  let departmentService: DepartmentService;
  let designationService: DesignationService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const admin: AuthenticatedUser = {
    userId: randomUUID(),
    email: `admin.${suffix}@example.test`,
    roles: ['ADMIN'],
  };
  const departmentId = randomUUID();
  const designationId = randomUUID();
  const createdEmployeeIds: string[] = [];
  const createdUserIds: string[] = [];
  const extraDepartmentCodes: string[] = [];
  const bigNumberPrefix = `EMP${new Date().getFullYear()}`;

  const makeEmployee = async (label: string, supervisorId?: string) => {
    const created = await employeeService.create(admin, {
      firstName: label,
      lastName: 'Lifecycle',
      email: `${label.toLowerCase()}.${suffix}@example.test`,
      departmentId,
      designationId,
      supervisorId,
    });
    createdEmployeeIds.push(created.id);
    return created;
  };

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
        DatabaseModule,
      ],
      providers: [EmployeeService, DepartmentService, DesignationService],
    }).compile();
    await moduleFixture.init();
    database = moduleFixture.get(DatabaseService);
    employeeService = moduleFixture.get(EmployeeService);
    departmentService = moduleFixture.get(DepartmentService);
    designationService = moduleFixture.get(DesignationService);

    await database.drizzle.insert(departmentsTable).values({
      id: departmentId,
      name: `Lifecycle Dept ${suffix}`,
      code: `LC_${suffix}`.slice(0, 24).toUpperCase(),
    });
    await database.drizzle.insert(designationsTable).values({
      id: designationId,
      title: `Lifecycle Designation ${suffix}`,
      code: `LCD_${suffix}`.slice(0, 24).toUpperCase(),
      departmentId,
    });
  });

  afterAll(async () => {
    if (database) {
      if (createdUserIds.length) {
        await database.drizzle.delete(users).where(inArray(users.id, createdUserIds));
      }
      await database.drizzle
        .delete(employeesTable)
        .where(like(employeesTable.email, `%.${suffix}@example.test`));
      await database.drizzle
        .delete(designationsTable)
        .where(eq(designationsTable.departmentId, departmentId));
      await database.drizzle.delete(departmentsTable).where(eq(departmentsTable.id, departmentId));
      for (const code of extraDepartmentCodes) {
        await database.drizzle.delete(departmentsTable).where(eq(departmentsTable.code, code));
      }
    }
    await moduleFixture?.close();
  });

  it('deactivates the linked account and sets exitDate on INACTIVE, and reactivates on ACTIVE', async () => {
    const employee = await makeEmployee('Leaver');
    const accountId = randomUUID();
    createdUserIds.push(accountId);
    await database.drizzle.insert(users).values({
      id: accountId,
      email: `leaver.account.${suffix}@example.test`,
      employeeId: employee.id,
      passwordHash: 'hash',
      firstName: 'Leaver',
      lastName: 'Lifecycle',
    });

    const inactive = await employeeService.update(admin, {
      id: employee.id,
      status: 'INACTIVE',
    });
    expect(inactive.isActive).toBe(false);
    expect(inactive.exitDate).toBe(new Date().toISOString().slice(0, 10));
    const [accountAfterLeave] = await database.drizzle
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, accountId));
    expect(accountAfterLeave.isActive).toBe(false);

    const active = await employeeService.update(admin, {
      id: employee.id,
      status: 'ACTIVE',
    });
    expect(active.isActive).toBe(true);
    expect(active.exitDate).toBeNull();
    const [accountAfterReturn] = await database.drizzle
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, accountId));
    expect(accountAfterReturn.isActive).toBe(true);

    // Dedicated deactivate path keeps behaving the same, including an explicit exit date
    const viaDeactivate = await employeeService.deactivate(admin, {
      id: employee.id,
      exitDate: '2026-03-31',
    });
    expect(viaDeactivate.exitDate).toBe('2026-03-31');
    await expect(
      employeeService.deactivate(admin, { id: employee.id, exitDate: 'not-a-date' }),
    ).rejects.toThrow(BadRequestException);
    const [accountAfterDeactivate] = await database.drizzle
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, accountId));
    expect(accountAfterDeactivate.isActive).toBe(false);
  });

  it('rejects supervisor assignments that create a reporting cycle', async () => {
    const top = await makeEmployee('CycleTop');
    const middle = await makeEmployee('CycleMiddle', top.id);
    const bottom = await makeEmployee('CycleBottom', middle.id);

    await expect(
      employeeService.update(admin, { id: top.id, supervisorId: bottom.id }),
    ).rejects.toThrow('reporting cycle');
    await expect(
      employeeService.update(admin, { id: top.id, supervisorId: middle.id }),
    ).rejects.toThrow('reporting cycle');
    await expect(
      employeeService.update(admin, { id: top.id, supervisorId: top.id }),
    ).rejects.toThrow('cannot supervise themselves');

    // A legal re-parent still works
    const moved = await employeeService.update(admin, {
      id: bottom.id,
      supervisorId: top.id,
    });
    expect(moved.supervisorId).toBe(top.id);
  });

  it('allocates employee numbers safely beyond 9999 and under concurrency', async () => {
    const seededNumber = `${bigNumberPrefix}9999`;
    await database.drizzle.insert(employeesTable).values({
      id: randomUUID(),
      employeeNumber: seededNumber,
      firstName: 'Seeded',
      lastName: 'Max',
      email: `seeded.max.${suffix}@example.test`,
      departmentId,
      designationId,
      joinDate: '2024-01-01',
    });

    const created = await Promise.all(
      ['NumA', 'NumB', 'NumC', 'NumD'].map((label) => makeEmployee(label)),
    );
    const numbers = created.map((employee) => employee.employeeNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const number of numbers) {
      expect(number.startsWith(bigNumberPrefix)).toBe(true);
      expect(Number(number.slice(bigNumberPrefix.length))).toBeGreaterThan(9999);
    }

    // A duplicate email now maps to a conflict, not a 500
    await expect(makeEmployee('NumA')).rejects.toThrow(ConflictException);
  });

  it('rejects a work email that belongs to another sign-in account (case-insensitive)', async () => {
    const accountEmail = `Signin.${suffix}@Example.Test`;
    const userId = randomUUID();
    await database.drizzle.insert(users).values({
      id: userId,
      email: accountEmail,
      passwordHash: 'x',
      firstName: 'Sign',
      lastName: 'In',
    });
    createdUserIds.push(userId);

    const message =
      'This email is already used by another sign-in account. Use a different work email.';
    const base = {
      firstName: 'Clash',
      lastName: 'Lifecycle',
      departmentId,
      designationId,
    };
    await expect(
      employeeService.create(admin, { ...base, email: accountEmail.toLowerCase() }),
    ).rejects.toThrow(message);
    await expect(
      employeeService.create(admin, { ...base, email: accountEmail.toUpperCase() }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Update: changing to that email is rejected, an unrelated email is fine.
    const employee = await makeEmployee('Clasher');
    await expect(
      employeeService.update(admin, { id: employee.id, email: accountEmail }),
    ).rejects.toThrow(message);
    const renamed = await employeeService.update(admin, {
      id: employee.id,
      email: `clasher.renamed.${suffix}@example.test`,
    });
    expect(renamed.email).toBe(`clasher.renamed.${suffix}@example.test`);

    // An account linked to this very employee does not block its own email.
    const linkedId = randomUUID();
    const linkedEmail = `clasher.linked.${suffix}@example.test`;
    await database.drizzle.insert(users).values({
      id: linkedId,
      email: linkedEmail,
      employeeId: employee.id,
      passwordHash: 'x',
      firstName: 'Clasher',
      lastName: 'Lifecycle',
    });
    createdUserIds.push(linkedId);
    const keptOwn = await employeeService.update(admin, { id: employee.id, email: linkedEmail });
    expect(keptOwn.email).toBe(linkedEmail);
  });

  it('blocks deactivating departments and designations that still have active people', async () => {
    const employee = await makeEmployee('Blocker');
    const extra = await makeEmployee('BlockerTwo');
    expect(extra.id).toBeDefined();
    const activeCount = (
      await database.drizzle
        .select({ id: employeesTable.id })
        .from(employeesTable)
        .where(and(eq(employeesTable.departmentId, departmentId), eq(employeesTable.isActive, true)))
    ).length;
    expect(activeCount).toBeGreaterThanOrEqual(2);

    await expect(designationService.deactivate({ id: designationId })).rejects.toThrow(
      /it still has \d+ active employees?\. Reassign them first/,
    );
    const departmentBlock = await departmentService
      .deactivate({ id: departmentId })
      .catch((error: Error) => error.message);
    expect(departmentBlock).toBe(
      `Cannot deactivate this department: it still has ${activeCount} active ${activeCount === 1 ? 'employee' : 'employees'} and 1 active designation. Reassign or deactivate them first.`,
    );
    expect(departmentBlock).not.toContain('(s)');

    // Once everything is inactive the deactivations succeed
    await database.drizzle
      .update(employeesTable)
      .set({ isActive: false, status: 'INACTIVE' })
      .where(eq(employeesTable.departmentId, departmentId));
    expect(employee.id).toBeDefined();
    const inactiveDesignation = await designationService.deactivate({ id: designationId });
    expect(inactiveDesignation.isActive).toBe(false);
    const inactiveDepartment = await departmentService.deactivate({ id: departmentId });
    expect(inactiveDepartment.isActive).toBe(false);
  });

  it('uses the singular for exactly one active employee or designation', async () => {
    const soloDepartmentId = randomUUID();
    const soloCode = `SOLOD_${suffix}`.slice(0, 24).toUpperCase();
    extraDepartmentCodes.push(soloCode);
    await database.drizzle
      .insert(departmentsTable)
      .values({ id: soloDepartmentId, name: `Solo Dept ${suffix}`, code: soloCode });
    const soloDeptDesignationId = randomUUID();
    await database.drizzle.insert(designationsTable).values({
      id: soloDeptDesignationId,
      title: `Solo Dept Designation ${suffix}`,
      code: `SOLOX_${suffix}`.slice(0, 24).toUpperCase(),
      departmentId: soloDepartmentId,
    });
    const soloEmployeeId = randomUUID();
    await database.drizzle.insert(employeesTable).values({
      id: soloEmployeeId,
      employeeNumber: `SOLO${suffix}`.slice(0, 20),
      firstName: 'Solo',
      lastName: 'Lifecycle',
      email: `solo.${suffix}@example.test`,
      departmentId: soloDepartmentId,
      designationId: soloDeptDesignationId,
      joinDate: '2026-01-01',
    });
    createdEmployeeIds.push(soloEmployeeId);

    await expect(designationService.deactivate({ id: soloDeptDesignationId })).rejects.toThrow(
      'Cannot deactivate this designation: it still has 1 active employee. Reassign them first.',
    );
    await expect(departmentService.deactivate({ id: soloDepartmentId })).rejects.toThrow(
      'Cannot deactivate this department: it still has 1 active employee and 1 active designation. Reassign or deactivate them first.',
    );

    await database.drizzle.delete(employeesTable).where(eq(employeesTable.id, soloEmployeeId));
    await database.drizzle
      .delete(designationsTable)
      .where(eq(designationsTable.id, soloDeptDesignationId));
  });

  it('maps concurrent duplicate department creation to a conflict', async () => {
    const code = `RACE_${randomUUID().slice(0, 8)}`.toUpperCase();
    extraDepartmentCodes.push(code);
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, (_, index) =>
        departmentService.create({ name: `Race Dept ${code} ${index % 1}`, code }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(ConflictException);
      }
    }
  });
});
