import { ConfigModule } from '@nestjs/config';
import { TestingModule, Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
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
          envFilePath:
            process.env.NODE_ENV === 'test'
              ? ['.env.test', '../../.env.test', '.env', '../../.env']
              : ['.env', '../../.env'],
        }),
        DatabaseModule,
      ],
      providers: [RecruitmentService],
    }).compile();

    await moduleFixture.init();

    database = moduleFixture.get(DatabaseService);
    recruitment = moduleFixture.get(RecruitmentService);

    await database.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          first_name,
          last_name,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)
      `,
      [
        userId,
        currentUser.email,
        'integration-test-password-hash',
        'Recruitment',
        'Tester',
      ],
    );

    await database.query(
      `
        INSERT INTO departments (id, name, code, description, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
      `,
      [
        departmentId,
        `Recruitment Department ${suffix}`,
        `REC_DEPT_${suffix}`.slice(0, 24).toUpperCase(),
        'Recruitment Drizzle integration department',
      ],
    );

    await database.query(
      `
        INSERT INTO designations (
          id,
          title,
          code,
          department_id,
          level,
          description,
          is_active
        )
        VALUES ($1, $2, $3, $4, 2, $5, TRUE)
      `,
      [
        designationId,
        `Recruitment Designation ${suffix}`,
        `REC_DES_${suffix}`.slice(0, 24).toUpperCase(),
        departmentId,
        'Recruitment Drizzle integration designation',
      ],
    );
  });

  afterAll(async () => {
    if (database) {
      await database.query('DELETE FROM recruitment_applications WHERE id = $1', [
        applicationId,
      ]);
      await database.query('DELETE FROM job_requisitions WHERE id = $1', [
        requisitionId,
      ]);
      await database.query('DELETE FROM designations WHERE id = $1', [
        designationId,
      ]);
      await database.query('DELETE FROM departments WHERE id = $1', [
        departmentId,
      ]);
      await database.query('DELETE FROM users WHERE id = $1', [userId]);
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
