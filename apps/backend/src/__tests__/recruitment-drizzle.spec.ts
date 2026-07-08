import { ConfigModule } from '@nestjs/config';
import { TestingModule, Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
  jobRequisitions,
  recruitmentApplications,
  users,
} from '../database/drizzle/schema';
import { RecruitmentService } from '../recruitment/recruitment.service';

jest.setTimeout(30000);

describe('Recruitment Drizzle migration', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let recruitment: RecruitmentService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const departmentId = randomUUID();
  const designationId = randomUUID();
  const userId = randomUUID();
  const currentUser: AuthenticatedUser = {
    userId,
    email: `recruiter.${suffix}@example.test`,
    roles: ['ADMIN'],
  };

  let requisitionId = '';
  let applicationId = '';

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
        }),
        DatabaseModule,
      ],
      providers: [RecruitmentService],
    }).compile();

    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    recruitment = moduleFixture.get(RecruitmentService);

    await database.drizzle.insert(users).values({
      id: userId,
      email: currentUser.email,
      passwordHash: 'integration-test-password-hash',
      firstName: 'Recruitment',
      lastName: 'Tester',
      isActive: true,
    });

    await database.drizzle.insert(departments).values({
      id: departmentId,
      name: `Recruitment Department ${suffix}`,
      code: `REC_DEPT_${suffix}`.slice(0, 24).toUpperCase(),
      description: 'Recruitment Drizzle integration department',
      isActive: true,
    });

    await database.drizzle.insert(designations).values({
      id: designationId,
      title: `Recruitment Designation ${suffix}`,
      code: `REC_DES_${suffix}`.slice(0, 24).toUpperCase(),
      departmentId,
      level: 2,
      description: 'Recruitment Drizzle integration designation',
      isActive: true,
    });
  });

  afterAll(async () => {
    if (database) {
      if (applicationId) {
        await database.drizzle
          .delete(recruitmentApplications)
          .where(eq(recruitmentApplications.id, applicationId));
      }
      if (requisitionId) {
        await database.drizzle
          .delete(jobRequisitions)
          .where(eq(jobRequisitions.id, requisitionId));
      }
      await database.drizzle
        .delete(designations)
        .where(eq(designations.id, designationId));
      await database.drizzle
        .delete(departments)
        .where(eq(departments.id, departmentId));
      await database.drizzle.delete(users).where(eq(users.id, userId));
    }

    await moduleFixture?.close();
  });

  it('creates, lists, updates, and advances recruitment records', async () => {
    const createdRequisition = await recruitment.createJobRequisition(currentUser, {
      jobTitle: `Drizzle Recruiter ${suffix}`,
      departmentId,
      designationId,
      positionsCount: 2,
      employmentType: 'FULL_TIME',
      priority: 'HIGH',
      targetStartDate: '2026-09-01',
      salaryMin: 12000,
      salaryMax: 18000,
      currencyCode: 'AED',
      description: 'Created by Drizzle recruitment proof',
      requirements: 'Careful migration proof',
    });

    requisitionId = createdRequisition.id;
    expect(createdRequisition.departmentId).toBe(departmentId);
    expect(createdRequisition.applicationCount).toBe(0);

    const updatedRequisition = await recruitment.updateJobRequisition(currentUser, {
      id: requisitionId,
      priority: 'URGENT',
      salaryMax: 19000,
    });

    expect(updatedRequisition.priority).toBe('URGENT');
    expect(updatedRequisition.salaryMax).toBe(19000);

    const createdApplication = await recruitment.createRecruitmentApplication(
      currentUser,
      {
        requisitionId,
        firstName: 'Candidate',
        lastName: `Drizzle ${suffix}`,
        email: `candidate.${suffix}@example.test`,
        phone: '+971500000001',
        source: 'Referral',
        yearsExperience: 4,
        expectedSalary: 17000,
        resumeUrl: 'https://example.test/resume.pdf',
        notes: 'Created by recruitment Drizzle proof',
      },
    );

    applicationId = createdApplication.id;
    expect(createdApplication.status).toBe('RECEIVED');
    expect(createdApplication.requisitionId).toBe(requisitionId);

    await expect(
      recruitment.createRecruitmentApplication(currentUser, {
        requisitionId,
        firstName: 'Candidate',
        lastName: 'Duplicate',
        email: `candidate.${suffix}@example.test`,
      }),
    ).rejects.toThrow(
      'This candidate already has an application for the requisition',
    );

    const requisitions = await recruitment.jobRequisitions(currentUser, {
      search: `Drizzle Recruiter ${suffix}`,
      departmentId,
      status: 'OPEN',
    });

    expect(requisitions.map((item) => item.id)).toContain(requisitionId);
    expect(
      requisitions.find((item) => item.id === requisitionId)?.applicationCount,
    ).toBe(1);

    const applications = await recruitment.recruitmentApplications(currentUser, {
      requisitionId,
      search: `candidate.${suffix}@example.test`,
      status: 'RECEIVED',
    });

    expect(applications.map((item) => item.id)).toContain(applicationId);

    const advancedApplication = await recruitment.advanceRecruitmentApplication(
      currentUser,
      {
        id: applicationId,
        status: 'SCREENING',
        decisionNotes: 'Advanced by Drizzle proof',
      },
    );

    expect(advancedApplication.status).toBe('SCREENING');
    expect(advancedApplication.decisionNotes).toBe('Advanced by Drizzle proof');
    expect(advancedApplication.lastActionByName).toBe('Recruitment Tester');

    const heldRequisition = await recruitment.changeJobRequisitionStatus(
      currentUser,
      {
        id: requisitionId,
        status: 'ON_HOLD',
      },
    );

    expect(heldRequisition.status).toBe('ON_HOLD');

    const summary = await recruitment.recruitmentSummary(currentUser);
    expect(summary.openRequisitions).toBeGreaterThanOrEqual(1);
    expect(summary.activeApplications).toBeGreaterThanOrEqual(1);
  });
});
