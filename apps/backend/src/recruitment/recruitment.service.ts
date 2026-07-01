import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  and,
  desc,
  eq,
  ilike,
  ne,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { assertAccountManagerAccess } from '../common/access-control';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
  jobRequisitions,
  recruitmentApplications,
  users,
} from '../database/drizzle/schema';
import {
  AdvanceRecruitmentApplicationInput,
  ChangeJobRequisitionStatusInput,
  CreateJobRequisitionInput,
  CreateRecruitmentApplicationInput,
  JobRequisitionFilterInput,
  RecruitmentApplicationFilterInput,
  UpdateJobRequisitionInput,
  UpdateRecruitmentApplicationInput,
} from './recruitment.types';

const REQUISITION_STATUSES = ['OPEN', 'ON_HOLD', 'FILLED', 'CLOSED'] as const;
const OPEN_REQUISITION_STATUSES = ['OPEN', 'ON_HOLD'] as const;
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const;
const REQUISITION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const APPLICATION_FORWARD_PATH = [
  'RECEIVED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'SELECTED',
  'OFFER_EXTENDED',
  'HIRED',
] as const;
const APPLICATION_TERMINAL_STATUSES = ['REJECTED', 'WITHDRAWN'] as const;
const APPLICATION_FINAL_STATUSES = ['HIRED', ...APPLICATION_TERMINAL_STATUSES] as const;
const APPLICATION_STATUSES = [
  ...APPLICATION_FORWARD_PATH,
  ...APPLICATION_TERMINAL_STATUSES,
] as const;

type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];
type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
type RequisitionPriority = (typeof REQUISITION_PRIORITIES)[number];

interface JobRequisitionRow {
  id: string;
  requisitionNumber: string;
  jobTitle: string;
  departmentId: string;
  departmentName: string;
  designationId: string | null;
  designationTitle: string | null;
  positionsCount: number;
  employmentType: string;
  priority: string;
  status: string;
  targetStartDate: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currencyCode: string;
  description: string;
  requirements: string | null;
  applicationCount: number;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
}

interface RecruitmentApplicationRow {
  id: string;
  applicationNumber: string;
  requisitionId: string;
  requisitionNumber: string;
  jobTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: string | null;
  yearsExperience: number | null;
  expectedSalary: number | null;
  resumeUrl: string | null;
  status: string;
  notes: string | null;
  decisionNotes: string | null;
  appliedAt: string;
  lastActionAt: string | null;
  lastActionByName: string | null;
}

const recruitmentActionUsers = alias(users, 'recruitment_action_users');

@Injectable()
export class RecruitmentService {
  constructor(private readonly database: DatabaseService) {}

  async jobRequisitions(
    currentUser: AuthenticatedUser,
    filter?: JobRequisitionFilterInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const where: SQL[] = [];

    if (filter?.search?.trim()) {
      const search = `%${filter.search.trim()}%`;
      const searchCondition = or(
        ilike(jobRequisitions.requisitionNumber, search),
        ilike(jobRequisitions.jobTitle, search),
        ilike(jobRequisitions.description, search),
      );
      if (searchCondition) {
        where.push(searchCondition);
      }
    }

    if (filter?.status?.trim()) {
      where.push(eq(jobRequisitions.status, filter.status.trim().toUpperCase()));
    }

    if (filter?.departmentId) {
      where.push(eq(jobRequisitions.departmentId, filter.departmentId));
    }

    const rows = await this.findRequisitionRows(where);

    return rows.map((row) => this.mapRequisition(row));
  }

  async jobRequisition(currentUser: AuthenticatedUser, id: string) {
    assertAccountManagerAccess(currentUser.roles);
    return this.findJobRequisition(id);
  }

  async recruitmentApplications(
    currentUser: AuthenticatedUser,
    filter?: RecruitmentApplicationFilterInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const where: SQL[] = [];

    if (filter?.search?.trim()) {
      const search = `%${filter.search.trim()}%`;
      const searchCondition = or(
        ilike(recruitmentApplications.firstName, search),
        ilike(recruitmentApplications.lastName, search),
        ilike(recruitmentApplications.email, search),
        ilike(recruitmentApplications.applicationNumber, search),
        ilike(jobRequisitions.jobTitle, search),
      );
      if (searchCondition) {
        where.push(searchCondition);
      }
    }

    if (filter?.requisitionId) {
      where.push(eq(recruitmentApplications.requisitionId, filter.requisitionId));
    }

    if (filter?.status?.trim()) {
      where.push(
        eq(recruitmentApplications.status, filter.status.trim().toUpperCase()),
      );
    }

    const rows = await this.findApplicationRows(where);

    return rows.map((row) => this.mapApplication(row));
  }

  async recruitmentSummary(currentUser: AuthenticatedUser) {
    assertAccountManagerAccess(currentUser.roles);
    const [row] = await this.database.drizzle
      .select({
        openRequisitions: sql<number>`COUNT(*) FILTER (
          WHERE ${jobRequisitions.status} IN ('OPEN', 'ON_HOLD')
        )::int`,
        activeApplications: sql<number>`COUNT(${recruitmentApplications.id}) FILTER (
          WHERE ${recruitmentApplications.status} NOT IN ('HIRED', 'REJECTED', 'WITHDRAWN')
        )::int`,
        screeningApplications: sql<number>`COUNT(${recruitmentApplications.id}) FILTER (
          WHERE ${recruitmentApplications.status} IN (
            'SCREENING',
            'SHORTLISTED',
            'INTERVIEW_SCHEDULED',
            'INTERVIEWED'
          )
        )::int`,
        selectedApplications: sql<number>`COUNT(${recruitmentApplications.id}) FILTER (
          WHERE ${recruitmentApplications.status} IN ('SELECTED', 'OFFER_EXTENDED', 'HIRED')
        )::int`,
      })
      .from(jobRequisitions)
      .leftJoin(
        recruitmentApplications,
        eq(recruitmentApplications.requisitionId, jobRequisitions.id),
      );

    return {
      openRequisitions: row?.openRequisitions ?? 0,
      activeApplications: row?.activeApplications ?? 0,
      screeningApplications: row?.screeningApplications ?? 0,
      selectedApplications: row?.selectedApplications ?? 0,
    };
  }

  async createJobRequisition(
    currentUser: AuthenticatedUser,
    input: CreateJobRequisitionInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const departmentId = input.departmentId;
    const designationId = input.designationId?.trim() || null;
    await this.assertDepartmentAndDesignation(departmentId, designationId);
    this.assertSalaryRange(input.salaryMin ?? null, input.salaryMax ?? null);

    const [created] = await this.database.drizzle
      .insert(jobRequisitions)
      .values({
        id: randomUUID(),
        requisitionNumber: this.generateRecordNumber('REQ'),
        jobTitle: input.jobTitle.trim(),
        departmentId,
        designationId,
        positionsCount: input.positionsCount ?? 1,
        employmentType: this.normalizeEmploymentType(input.employmentType),
        priority: this.normalizePriority(input.priority),
        targetStartDate: input.targetStartDate?.trim() || null,
        salaryMin: input.salaryMin ?? null,
        salaryMax: input.salaryMax ?? null,
        currencyCode: input.currencyCode?.trim().toUpperCase() ?? 'AED',
        description: input.description.trim(),
        requirements: input.requirements?.trim() || null,
        createdByUserId: currentUser.userId,
      })
      .returning({ id: jobRequisitions.id });

    return this.findJobRequisition(created.id);
  }

  async updateJobRequisition(
    currentUser: AuthenticatedUser,
    input: UpdateJobRequisitionInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const existing = await this.getRawRequisition(input.id);
    const departmentId = input.departmentId ?? existing.departmentId;
    const designationId =
      input.designationId !== undefined
        ? input.designationId?.trim() || null
        : existing.designationId;
    const salaryMin =
      input.salaryMin !== undefined ? input.salaryMin : existing.salaryMin;
    const salaryMax =
      input.salaryMax !== undefined ? input.salaryMax : existing.salaryMax;

    await this.assertDepartmentAndDesignation(departmentId, designationId);
    this.assertSalaryRange(salaryMin, salaryMax);

    await this.database.drizzle
      .update(jobRequisitions)
      .set({
        jobTitle: input.jobTitle?.trim() ?? existing.jobTitle,
        departmentId,
        designationId,
        positionsCount: input.positionsCount ?? existing.positionsCount,
        employmentType:
          input.employmentType !== undefined
            ? this.normalizeEmploymentType(input.employmentType)
            : existing.employmentType,
        priority:
          input.priority !== undefined
            ? this.normalizePriority(input.priority)
            : existing.priority,
        targetStartDate:
          input.targetStartDate !== undefined
            ? input.targetStartDate?.trim() || null
            : existing.targetStartDate,
        salaryMin,
        salaryMax,
        currencyCode: input.currencyCode?.trim().toUpperCase() ?? existing.currencyCode,
        description: input.description?.trim() ?? existing.description,
        requirements:
          input.requirements !== undefined
            ? input.requirements?.trim() || null
            : existing.requirements,
        updatedAt: sql`NOW()`,
      })
      .where(eq(jobRequisitions.id, input.id));

    return this.findJobRequisition(input.id);
  }

  async changeJobRequisitionStatus(
    currentUser: AuthenticatedUser,
    input: ChangeJobRequisitionStatusInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const existing = await this.getRawRequisition(input.id);
    const status = this.normalizeRequisitionStatus(input.status);
    this.assertRequisitionTransition(existing.status as RequisitionStatus, status);

    await this.database.drizzle
      .update(jobRequisitions)
      .set({
        status,
        closedAt: ['FILLED', 'CLOSED'].includes(status) ? sql`NOW()` : null,
        updatedAt: sql`NOW()`,
      })
      .where(eq(jobRequisitions.id, input.id));

    return this.findJobRequisition(input.id);
  }

  async createRecruitmentApplication(
    currentUser: AuthenticatedUser,
    input: CreateRecruitmentApplicationInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const requisition = await this.getRawRequisition(input.requisitionId);
    if (
      !OPEN_REQUISITION_STATUSES.includes(
        requisition.status as (typeof OPEN_REQUISITION_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        'Applications can only be created for open or on-hold requisitions',
      );
    }

    const email = input.email.trim().toLowerCase();
    this.assertNonNegative(input.yearsExperience, 'Years experience');
    this.assertNonNegative(input.expectedSalary, 'Expected salary');
    const [duplicate] = await this.database.drizzle
      .select({ id: recruitmentApplications.id })
      .from(recruitmentApplications)
      .where(
        and(
          eq(recruitmentApplications.requisitionId, input.requisitionId),
          eq(recruitmentApplications.email, email),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictException(
        'This candidate already has an application for the requisition',
      );
    }

    const [created] = await this.database.drizzle
      .insert(recruitmentApplications)
      .values({
        id: randomUUID(),
        applicationNumber: this.generateRecordNumber('APP'),
        requisitionId: input.requisitionId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone?.trim() || null,
        source: input.source?.trim() || null,
        yearsExperience: input.yearsExperience ?? null,
        expectedSalary: input.expectedSalary ?? null,
        resumeUrl: input.resumeUrl?.trim() || null,
        notes: input.notes?.trim() || null,
        lastActionByUserId: currentUser.userId,
        lastActionAt: sql`NOW()`,
      })
      .returning({ id: recruitmentApplications.id });

    return this.findRecruitmentApplication(created.id);
  }

  async updateRecruitmentApplication(
    currentUser: AuthenticatedUser,
    input: UpdateRecruitmentApplicationInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const existing = await this.getRawApplication(input.id);
    const email =
      input.email !== undefined ? input.email.trim().toLowerCase() : existing.email;
    this.assertNonNegative(input.yearsExperience, 'Years experience');
    this.assertNonNegative(input.expectedSalary, 'Expected salary');

    if (email !== existing.email) {
      const [duplicate] = await this.database.drizzle
        .select({ id: recruitmentApplications.id })
        .from(recruitmentApplications)
        .where(
          and(
            eq(recruitmentApplications.requisitionId, existing.requisitionId),
            eq(recruitmentApplications.email, email),
            ne(recruitmentApplications.id, input.id),
          ),
        )
        .limit(1);

      if (duplicate) {
        throw new ConflictException(
          'This candidate already has an application for the requisition',
        );
      }
    }

    await this.database.drizzle
      .update(recruitmentApplications)
      .set({
        firstName: input.firstName?.trim() ?? existing.firstName,
        lastName: input.lastName?.trim() ?? existing.lastName,
        email,
        phone: input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
        source:
          input.source !== undefined ? input.source?.trim() || null : existing.source,
        yearsExperience:
          input.yearsExperience !== undefined
            ? input.yearsExperience
            : existing.yearsExperience,
        expectedSalary:
          input.expectedSalary !== undefined
            ? input.expectedSalary
            : existing.expectedSalary,
        resumeUrl:
          input.resumeUrl !== undefined
            ? input.resumeUrl?.trim() || null
            : existing.resumeUrl,
        notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
        lastActionByUserId: currentUser.userId,
        lastActionAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(recruitmentApplications.id, input.id));

    return this.findRecruitmentApplication(input.id);
  }

  async advanceRecruitmentApplication(
    currentUser: AuthenticatedUser,
    input: AdvanceRecruitmentApplicationInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const existing = await this.getRawApplication(input.id);
    const status = this.normalizeApplicationStatus(input.status);
    this.assertApplicationTransition(existing.status as ApplicationStatus, status);

    await this.database.drizzle
      .update(recruitmentApplications)
      .set({
        status,
        decisionNotes: input.decisionNotes?.trim() || existing.decisionNotes,
        lastActionByUserId: currentUser.userId,
        lastActionAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(recruitmentApplications.id, input.id));

    return this.findRecruitmentApplication(input.id);
  }

  private async findRequisitionRows(where: SQL[]): Promise<JobRequisitionRow[]> {
    return this.database.drizzle
      .select({
        id: jobRequisitions.id,
        requisitionNumber: jobRequisitions.requisitionNumber,
        jobTitle: jobRequisitions.jobTitle,
        departmentId: jobRequisitions.departmentId,
        departmentName: departments.name,
        designationId: jobRequisitions.designationId,
        designationTitle: designations.title,
        positionsCount: jobRequisitions.positionsCount,
        employmentType: jobRequisitions.employmentType,
        priority: jobRequisitions.priority,
        status: jobRequisitions.status,
        targetStartDate: sql<string | null>`${jobRequisitions.targetStartDate}::text`,
        salaryMin: jobRequisitions.salaryMin,
        salaryMax: jobRequisitions.salaryMax,
        currencyCode: jobRequisitions.currencyCode,
        description: jobRequisitions.description,
        requirements: jobRequisitions.requirements,
        applicationCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${recruitmentApplications}
          WHERE ${recruitmentApplications.requisitionId} = ${jobRequisitions.id}
        )`,
        openedAt: sql<string>`${jobRequisitions.openedAt}::text`,
        closedAt: sql<string | null>`${jobRequisitions.closedAt}::text`,
        createdAt: sql<string>`${jobRequisitions.createdAt}::text`,
      })
      .from(jobRequisitions)
      .innerJoin(departments, eq(departments.id, jobRequisitions.departmentId))
      .leftJoin(designations, eq(designations.id, jobRequisitions.designationId))
      .where(and(...where))
      .orderBy(this.requisitionStatusOrder(), desc(jobRequisitions.createdAt));
  }

  private async findApplicationRows(
    where: SQL[],
  ): Promise<RecruitmentApplicationRow[]> {
    return this.database.drizzle
      .select({
        id: recruitmentApplications.id,
        applicationNumber: recruitmentApplications.applicationNumber,
        requisitionId: recruitmentApplications.requisitionId,
        requisitionNumber: jobRequisitions.requisitionNumber,
        jobTitle: jobRequisitions.jobTitle,
        firstName: recruitmentApplications.firstName,
        lastName: recruitmentApplications.lastName,
        email: recruitmentApplications.email,
        phone: recruitmentApplications.phone,
        source: recruitmentApplications.source,
        yearsExperience: recruitmentApplications.yearsExperience,
        expectedSalary: recruitmentApplications.expectedSalary,
        resumeUrl: recruitmentApplications.resumeUrl,
        status: recruitmentApplications.status,
        notes: recruitmentApplications.notes,
        decisionNotes: recruitmentApplications.decisionNotes,
        appliedAt: sql<string>`${recruitmentApplications.appliedAt}::text`,
        lastActionAt: sql<string | null>`${recruitmentApplications.lastActionAt}::text`,
        lastActionByName: sql<string | null>`CASE
          WHEN ${recruitmentActionUsers.id} IS NULL THEN NULL
          ELSE CONCAT(${recruitmentActionUsers.firstName}, ' ', ${recruitmentActionUsers.lastName})
        END`,
      })
      .from(recruitmentApplications)
      .innerJoin(
        jobRequisitions,
        eq(jobRequisitions.id, recruitmentApplications.requisitionId),
      )
      .leftJoin(
        recruitmentActionUsers,
        eq(recruitmentActionUsers.id, recruitmentApplications.lastActionByUserId),
      )
      .where(and(...where))
      .orderBy(this.applicationStatusOrder(), desc(recruitmentApplications.appliedAt));
  }

  private requisitionStatusOrder() {
    return sql<number>`CASE ${jobRequisitions.status}
      WHEN 'OPEN' THEN 1
      WHEN 'ON_HOLD' THEN 2
      WHEN 'FILLED' THEN 3
      ELSE 4
    END`;
  }

  private applicationStatusOrder() {
    return sql<number>`CASE ${recruitmentApplications.status}
      WHEN 'RECEIVED' THEN 1
      WHEN 'SCREENING' THEN 2
      WHEN 'SHORTLISTED' THEN 3
      WHEN 'INTERVIEW_SCHEDULED' THEN 4
      WHEN 'INTERVIEWED' THEN 5
      WHEN 'SELECTED' THEN 6
      WHEN 'OFFER_EXTENDED' THEN 7
      WHEN 'HIRED' THEN 8
      ELSE 9
    END`;
  }

  private async findJobRequisition(id: string) {
    const [row] = await this.findRequisitionRows([eq(jobRequisitions.id, id)]);

    if (!row) {
      throw new NotFoundException('Job requisition not found');
    }

    return this.mapRequisition(row);
  }

  private async findRecruitmentApplication(id: string) {
    const [row] = await this.findApplicationRows([
      eq(recruitmentApplications.id, id),
    ]);

    if (!row) {
      throw new NotFoundException('Recruitment application not found');
    }

    return this.mapApplication(row);
  }

  private async getRawRequisition(id: string) {
    const [row] = await this.database.drizzle
      .select({
        id: jobRequisitions.id,
        jobTitle: jobRequisitions.jobTitle,
        departmentId: jobRequisitions.departmentId,
        designationId: jobRequisitions.designationId,
        positionsCount: jobRequisitions.positionsCount,
        employmentType: jobRequisitions.employmentType,
        priority: jobRequisitions.priority,
        status: jobRequisitions.status,
        targetStartDate: sql<string | null>`${jobRequisitions.targetStartDate}::text`,
        salaryMin: jobRequisitions.salaryMin,
        salaryMax: jobRequisitions.salaryMax,
        currencyCode: jobRequisitions.currencyCode,
        description: jobRequisitions.description,
        requirements: jobRequisitions.requirements,
      })
      .from(jobRequisitions)
      .where(eq(jobRequisitions.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Job requisition not found');
    }

    return row;
  }

  private async getRawApplication(id: string) {
    const [row] = await this.database.drizzle
      .select({
        id: recruitmentApplications.id,
        requisitionId: recruitmentApplications.requisitionId,
        firstName: recruitmentApplications.firstName,
        lastName: recruitmentApplications.lastName,
        email: recruitmentApplications.email,
        phone: recruitmentApplications.phone,
        source: recruitmentApplications.source,
        yearsExperience: recruitmentApplications.yearsExperience,
        expectedSalary: recruitmentApplications.expectedSalary,
        resumeUrl: recruitmentApplications.resumeUrl,
        status: recruitmentApplications.status,
        notes: recruitmentApplications.notes,
        decisionNotes: recruitmentApplications.decisionNotes,
      })
      .from(recruitmentApplications)
      .where(eq(recruitmentApplications.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Recruitment application not found');
    }

    return row;
  }

  private async assertDepartmentAndDesignation(
    departmentId: string,
    designationId?: string | null,
  ) {
    const [department] = await this.database.drizzle
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.isActive, true)))
      .limit(1);

    if (!department) {
      throw new BadRequestException('Department not found or inactive');
    }

    if (!designationId) {
      return;
    }

    const [designation] = await this.database.drizzle
      .select({
        id: designations.id,
        departmentId: designations.departmentId,
      })
      .from(designations)
      .where(
        and(
          eq(designations.id, designationId),
          eq(designations.isActive, true),
        ),
      )
      .limit(1);

    if (!designation) {
      throw new BadRequestException('Designation not found or inactive');
    }

    if (designation.departmentId !== departmentId) {
      throw new BadRequestException(
        'Designation must belong to the selected department',
      );
    }
  }

  private assertSalaryRange(salaryMin?: number | null, salaryMax?: number | null) {
    this.assertNonNegative(salaryMin, 'Salary minimum');
    this.assertNonNegative(salaryMax, 'Salary maximum');

    if (
      salaryMin !== null &&
      salaryMin !== undefined &&
      salaryMax !== null &&
      salaryMax !== undefined &&
      salaryMin > salaryMax
    ) {
      throw new BadRequestException('Salary minimum cannot exceed salary maximum');
    }
  }

  private assertNonNegative(value: number | null | undefined, label: string) {
    if (value !== null && value !== undefined && value < 0) {
      throw new BadRequestException(`${label} cannot be negative`);
    }
  }

  private normalizeEmploymentType(value?: string | null): EmploymentType {
    const normalized = value?.trim().toUpperCase() || 'FULL_TIME';
    if (!EMPLOYMENT_TYPES.includes(normalized as EmploymentType)) {
      throw new BadRequestException('Invalid employment type');
    }

    return normalized as EmploymentType;
  }

  private normalizePriority(value?: string | null): RequisitionPriority {
    const normalized = value?.trim().toUpperCase() || 'MEDIUM';
    if (!REQUISITION_PRIORITIES.includes(normalized as RequisitionPriority)) {
      throw new BadRequestException('Invalid requisition priority');
    }

    return normalized as RequisitionPriority;
  }

  private normalizeRequisitionStatus(status: string): RequisitionStatus {
    const normalized = status.trim().toUpperCase();
    if (!REQUISITION_STATUSES.includes(normalized as RequisitionStatus)) {
      throw new BadRequestException('Invalid requisition status');
    }

    return normalized as RequisitionStatus;
  }

  private normalizeApplicationStatus(status: string): ApplicationStatus {
    const normalized = status.trim().toUpperCase();
    if (!APPLICATION_STATUSES.includes(normalized as ApplicationStatus)) {
      throw new BadRequestException('Invalid application status');
    }

    return normalized as ApplicationStatus;
  }

  private assertApplicationTransition(
    currentStatus: ApplicationStatus,
    nextStatus: ApplicationStatus,
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    if (APPLICATION_FINAL_STATUSES.includes(currentStatus as (typeof APPLICATION_FINAL_STATUSES)[number])) {
      throw new BadRequestException('Terminal applications cannot be advanced');
    }

    if (APPLICATION_TERMINAL_STATUSES.includes(nextStatus as (typeof APPLICATION_TERMINAL_STATUSES)[number])) {
      return;
    }

    const currentIndex = APPLICATION_FORWARD_PATH.indexOf(currentStatus as (typeof APPLICATION_FORWARD_PATH)[number]);
    const nextIndex = APPLICATION_FORWARD_PATH.indexOf(nextStatus as (typeof APPLICATION_FORWARD_PATH)[number]);
    if (nextIndex !== currentIndex + 1) {
      throw new BadRequestException('Application status must follow the hiring path');
    }
  }

  private assertRequisitionTransition(
    currentStatus: RequisitionStatus,
    nextStatus: RequisitionStatus,
  ) {
    if (currentStatus === nextStatus) {
      return;
    }

    if (currentStatus === 'FILLED' || currentStatus === 'CLOSED') {
      throw new BadRequestException('Terminal requisitions cannot be reopened');
    }

    if (currentStatus === 'OPEN') {
      if (!['ON_HOLD', 'FILLED', 'CLOSED'].includes(nextStatus)) {
        throw new BadRequestException('Invalid requisition status transition');
      }
      return;
    }

    if (currentStatus === 'ON_HOLD') {
      if (!['OPEN', 'FILLED', 'CLOSED'].includes(nextStatus)) {
        throw new BadRequestException('Invalid requisition status transition');
      }
    }
  }

  private mapRequisition(row: JobRequisitionRow) {
    return {
      ...row,
      positionsCount: Number(row.positionsCount),
      salaryMin: row.salaryMin === null ? null : Number(row.salaryMin),
      salaryMax: row.salaryMax === null ? null : Number(row.salaryMax),
      applicationCount: Number(row.applicationCount ?? 0),
    };
  }

  private mapApplication(row: RecruitmentApplicationRow) {
    return {
      ...row,
      candidateName: `${row.firstName} ${row.lastName}`,
      yearsExperience:
        row.yearsExperience === null ? null : Number(row.yearsExperience),
      expectedSalary:
        row.expectedSalary === null ? null : Number(row.expectedSalary),
    };
  }

  private generateRecordNumber(prefix: 'REQ' | 'APP') {
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
