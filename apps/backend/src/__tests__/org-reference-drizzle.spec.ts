import { ConfigModule } from '@nestjs/config';
import { TestingModule, Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  departments as departmentsTable,
  designations as designationsTable,
} from '../database/drizzle/schema';
import { DepartmentService } from '../org-reference/department.service';
import { DesignationService } from '../org-reference/designation.service';

jest.setTimeout(30000);

describe('Org reference Drizzle migration', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let departments: DepartmentService;
  let designations: DesignationService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const departmentCode = `DRZ_DEPT_${suffix}`.slice(0, 24).toUpperCase();
  const designationCode = `DRZ_DES_${suffix}`.slice(0, 24).toUpperCase();

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
        }),
        DatabaseModule,
      ],
      providers: [DepartmentService, DesignationService],
    }).compile();

    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    departments = moduleFixture.get(DepartmentService);
    designations = moduleFixture.get(DesignationService);
  });

  afterAll(async () => {
    if (database) {
      await database.drizzle
        .delete(designationsTable)
        .where(eq(designationsTable.code, designationCode));
      await database.drizzle
        .delete(departmentsTable)
        .where(eq(departmentsTable.code, departmentCode));
    }

    await moduleFixture?.close();
  });

  it('creates, reads, updates, and deactivates org reference records', async () => {
    const department = await departments.create({
      name: `Drizzle Department ${suffix}`,
      code: departmentCode,
      description: 'Created by Drizzle integration proof',
    });

    expect(department.code).toBe(departmentCode);
    expect(department.isActive).toBe(true);

    const designation = await designations.create({
      title: `Drizzle Designation ${suffix}`,
      code: designationCode,
      departmentId: department.id,
      level: 2,
      description: 'Created by Drizzle integration proof',
    });

    expect(designation.code).toBe(designationCode);
    expect(designation.department.id).toBe(department.id);

    const updatedDesignation = await designations.update({
      id: designation.id,
      level: 3,
      description: 'Updated by Drizzle integration proof',
    });

    expect(updatedDesignation.level).toBe(3);
    expect(updatedDesignation.description).toBe(
      'Updated by Drizzle integration proof',
    );

    const activeDesignations = await designations.findAll({
      departmentId: department.id,
      includeInactive: false,
    });

    expect(activeDesignations.map((item) => item.id)).toContain(designation.id);

    const inactiveDesignation = await designations.deactivate({
      id: designation.id,
    });

    expect(inactiveDesignation.isActive).toBe(false);

    const inactiveDepartment = await departments.deactivate({
      id: department.id,
    });

    expect(inactiveDepartment.isActive).toBe(false);
  });

  it('rejects duplicate department codes through the Drizzle path', async () => {
    const code = `DRZ_DUP_${randomUUID().slice(0, 8)}`.toUpperCase();

    await departments.create({
      name: `Drizzle Duplicate ${suffix}`,
      code,
    });

    await expect(
      departments.create({
        name: `Drizzle Duplicate Other ${suffix}`,
        code,
      }),
    ).rejects.toThrow('Department with this name or code already exists');

    await database.drizzle
      .delete(departmentsTable)
      .where(eq(departmentsTable.code, code));
  });
});
