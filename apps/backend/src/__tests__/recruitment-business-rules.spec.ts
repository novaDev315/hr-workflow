import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'crypto';
import { eq, inArray, sql } from 'drizzle-orm';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  jobRequisitions,
  recruitmentApplications,
  users,
} from '../database/drizzle/schema';
import { RecruitmentService } from '../recruitment/recruitment.service';
import {
  AdvanceRecruitmentApplicationInput,
  ChangeJobRequisitionStatusInput,
  CreateRecruitmentApplicationInput,
  UpdateRecruitmentApplicationInput,
} from '../recruitment/recruitment.types';

jest.setTimeout(60000);

describe('Recruitment business rules', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let recruitment: RecruitmentService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const departmentId = randomUUID();
  const userId = randomUUID();
  const admin: AuthenticatedUser = {
    userId,
    email: `recruit.rules.${suffix}@example.test`,
    roles: ['ADMIN'],
  };
  const requisitionIds: string[] = [];

  const newRequisition = async () => {
    const created = await recruitment.createJobRequisition(admin, {
      jobTitle: `Rules Engineer ${suffix}`,
      departmentId,
      description: 'Business rule proof',
    });
    requisitionIds.push(created.id);
    return created;
  };

  const applicant = (requisitionId: string, label: string) => ({
    requisitionId,
    firstName: label,
    lastName: 'Candidate',
    email: `${label.toLowerCase()}.${suffix}@example.test`,
  });

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
        DatabaseModule,
      ],
      providers: [RecruitmentService],
    }).compile();
    await moduleFixture.init();
    database = moduleFixture.get(DatabaseService);
    recruitment = moduleFixture.get(RecruitmentService);

    await database.drizzle.insert(users).values({
      id: userId,
      email: admin.email,
      passwordHash: 'hash',
      firstName: 'Recruit',
      lastName: 'Rules',
    });
    await database.drizzle.insert(departments).values({
      id: departmentId,
      name: `Recruit Rules Dept ${suffix}`,
      code: `RR_${suffix}`.slice(0, 24).toUpperCase(),
    });
  });

  afterAll(async () => {
    if (database) {
      if (requisitionIds.length) {
        await database.drizzle
          .delete(recruitmentApplications)
          .where(inArray(recruitmentApplications.requisitionId, requisitionIds));
        await database.drizzle
          .delete(jobRequisitions)
          .where(inArray(jobRequisitions.id, requisitionIds));
      }
      await database.drizzle.delete(departments).where(eq(departments.id, departmentId));
      await database.drizzle.delete(users).where(eq(users.id, userId));
    }
    await moduleFixture?.close();
  });

  it('counts open requisitions once regardless of applicant count', async () => {
    const requisition = await newRequisition();
    for (const label of ['SumA', 'SumB', 'SumC']) {
      await recruitment.createRecruitmentApplication(admin, applicant(requisition.id, label));
    }

    // Other specs share this database, so compare with a direct count taken
    // immediately before and after the summary instead of a fixed number.
    const countOpen = async () => {
      const [row] = await database.drizzle
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(jobRequisitions)
        .where(inArray(jobRequisitions.status, ['OPEN', 'ON_HOLD']));
      return row.total;
    };
    const before = await countOpen();
    const summary = await recruitment.recruitmentSummary(admin);
    const after = await countOpen();
    expect(summary.openRequisitions).toBeGreaterThanOrEqual(Math.min(before, after));
    expect(summary.openRequisitions).toBeLessThanOrEqual(Math.max(before, after));
    // 3 applicants on 1 requisition must not inflate the requisition count
    expect(summary.activeApplications).toBeGreaterThanOrEqual(3);

    const solo = await recruitment.jobRequisition(admin, requisition.id);
    expect(solo.applicationCount).toBe(3);
  });

  it('maps duplicate applications to a conflict, including concurrent ones', async () => {
    const requisition = await newRequisition();
    await recruitment.createRecruitmentApplication(admin, applicant(requisition.id, 'Dup'));
    await expect(
      recruitment.createRecruitmentApplication(admin, applicant(requisition.id, 'Dup')),
    ).rejects.toThrow(ConflictException);

    const racing = await newRequisition();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        recruitment.createRecruitmentApplication(admin, applicant(racing.id, 'Racer')),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(ConflictException);
      }
    }

    // Changing an application email onto an existing one is a conflict too
    const other = await recruitment.createRecruitmentApplication(
      admin,
      applicant(requisition.id, 'Other'),
    );
    await expect(
      recruitment.updateRecruitmentApplication(admin, {
        id: other.id,
        email: `dup.${suffix}@example.test`,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('only accepts http(s) resume links and lets the link be cleared', async () => {
    const requisition = await newRequisition();
    await expect(
      recruitment.createRecruitmentApplication(admin, {
        ...applicant(requisition.id, 'Resume'),
        resumeUrl: 'javascript:alert(1)',
      }),
    ).rejects.toThrow(BadRequestException);

    const created = await recruitment.createRecruitmentApplication(admin, {
      ...applicant(requisition.id, 'Resume'),
      resumeUrl: 'https://example.test/cv.pdf',
    });
    expect(created.resumeUrl).toBe('https://example.test/cv.pdf');

    const cleared = await recruitment.updateRecruitmentApplication(admin, {
      id: created.id,
      resumeUrl: '',
    });
    expect(cleared.resumeUrl).toBeNull();

    await expect(
      recruitment.updateRecruitmentApplication(admin, {
        id: created.id,
        resumeUrl: 'ftp://example.test/cv.pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('validates resumeUrl and status inputs at the GraphQL input layer', async () => {
    const base = {
      requisitionId: 'r',
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.test',
    };
    const bad = await validate(
      plainToInstance(CreateRecruitmentApplicationInput, {
        ...base,
        resumeUrl: 'javascript:alert(1)',
      }),
    );
    expect(bad.map((e) => e.property)).toContain('resumeUrl');
    const noProtocol = await validate(
      plainToInstance(CreateRecruitmentApplicationInput, { ...base, resumeUrl: 'example.test/cv' }),
    );
    expect(noProtocol.map((e) => e.property)).toContain('resumeUrl');
    for (const resumeUrl of ['https://example.test/cv.pdf', '', undefined]) {
      expect(
        await validate(plainToInstance(CreateRecruitmentApplicationInput, { ...base, resumeUrl })),
      ).toHaveLength(0);
    }
    expect(
      await validate(
        plainToInstance(UpdateRecruitmentApplicationInput, { id: 'x', resumeUrl: '' }),
      ),
    ).toHaveLength(0);

    const typo = await validate(
      plainToInstance(AdvanceRecruitmentApplicationInput, { id: 'x', status: 'SHORTLISTD' }),
    );
    expect(Object.values(typo[0].constraints ?? {})[0]).toMatch(/status must be one of: RECEIVED/);
    expect(
      await validate(
        plainToInstance(AdvanceRecruitmentApplicationInput, { id: 'x', status: ' screening ' }),
      ),
    ).toHaveLength(0);

    const badRequisition = await validate(
      plainToInstance(ChangeJobRequisitionStatusInput, { id: 'x', status: 'OPENN' }),
    );
    expect(Object.values(badRequisition[0].constraints ?? {})[0]).toMatch(
      /status must be one of: OPEN, ON_HOLD, FILLED, CLOSED/,
    );
  });
});
