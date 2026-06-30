import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../common/current-user.decorator';
import { assertAccountManagerAccess } from '../common/access-control';
import { DatabaseService } from '../database/database.service';
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

@Injectable()
export class RecruitmentService {
  constructor(private readonly database: DatabaseService) {}

  async jobRequisitions(
    currentUser: AuthenticatedUser,
    filter?: JobRequisitionFilterInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    const values: unknown[] = [];
    const where: string[] = [];

    if (filter?.search?.trim()) {
      const search = `%${filter.search.trim().toLowerCase()}%`;
      values.push(search);
      const index = values.length;
      where.push(
        `(
          LOWER(jr.requisition_number) LIKE $${index}
          OR LOWER(jr.job_title) LIKE $${index}
          OR LOWER(jr.description) LIKE $${index}
        )`,
      );
    }

    if (filter?.status?.trim()) {
      values.push(filter.status.trim().toUpperCase());
      where.push(`jr.status = $${values.length}`);
    }

    if (filter?.departmentId) {
      values.push(filter.departmentId);
      where.push(`jr.department_id = $${values.length}`);
    }

    const rows = await this.database.many<JobRequisitionRow>(
      `
        ${this.requisitionSelect()}
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ${this.requisitionGroupBy()}
        ORDER BY
          CASE jr.status
            WHEN 'OPEN' THEN 1
            WHEN 'ON_HOLD' THEN 2
            WHEN 'FILLED' THEN 3
            ELSE 4
          END,
          jr.created_at DESC
      `,
      values,
    );

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
    const values: unknown[] = [];
    const where: string[] = [];

    if (filter?.search?.trim()) {
      const search = `%${filter.search.trim().toLowerCase()}%`;
      values.push(search);
      const index = values.length;
      where.push(
        `(
          LOWER(ra.first_name) LIKE $${index}
          OR LOWER(ra.last_name) LIKE $${index}
          OR LOWER(ra.email) LIKE $${index}
          OR LOWER(ra.application_number) LIKE $${index}
          OR LOWER(jr.job_title) LIKE $${index}
        )`,
      );
    }

    if (filter?.requisitionId) {
      values.push(filter.requisitionId);
      where.push(`ra.requisition_id = $${values.length}`);
    }

    if (filter?.status?.trim()) {
      values.push(filter.status.trim().toUpperCase());
      where.push(`ra.status = $${values.length}`);
    }

    const rows = await this.database.many<RecruitmentApplicationRow>(
      `
        ${this.applicationSelect()}
        ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY
          CASE ra.status
            WHEN 'RECEIVED' THEN 1
            WHEN 'SCREENING' THEN 2
            WHEN 'SHORTLISTED' THEN 3
            WHEN 'INTERVIEW_SCHEDULED' THEN 4
            WHEN 'INTERVIEWED' THEN 5
            WHEN 'SELECTED' THEN 6
            WHEN 'OFFER_EXTENDED' THEN 7
            WHEN 'HIRED' THEN 8
            ELSE 9
          END,
          ra.applied_at DESC
      `,
      values,
    );

    return rows.map((row) => this.mapApplication(row));
  }

  async recruitmentSummary(currentUser: AuthenticatedUser) {
    assertAccountManagerAccess(currentUser.roles);
    const row = await this.database.one<{
      openRequisitions: number;
      activeApplications: number;
      screeningApplications: number;
      selectedApplications: number;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE jr.status IN ('OPEN', 'ON_HOLD'))::int AS "openRequisitions",
          COUNT(ra.id) FILTER (
            WHERE ra.status NOT IN ('HIRED', 'REJECTED', 'WITHDRAWN')
          )::int AS "activeApplications",
          COUNT(ra.id) FILTER (
            WHERE ra.status IN ('SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED')
          )::int AS "screeningApplications",
          COUNT(ra.id) FILTER (
            WHERE ra.status IN ('SELECTED', 'OFFER_EXTENDED', 'HIRED')
          )::int AS "selectedApplications"
        FROM job_requisitions jr
        LEFT JOIN recruitment_applications ra ON ra.requisition_id = jr.id
      `,
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

    const created = await this.database.one<{ id: string }>(
      `
        INSERT INTO job_requisitions (
          id,
          requisition_number,
          job_title,
          department_id,
          designation_id,
          positions_count,
          employment_type,
          priority,
          target_start_date,
          salary_min,
          salary_max,
          currency_code,
          description,
          requirements,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `,
      [
        randomUUID(),
        this.generateRecordNumber('REQ'),
        input.jobTitle.trim(),
        departmentId,
        designationId,
        input.positionsCount ?? 1,
        this.normalizeEmploymentType(input.employmentType),
        this.normalizePriority(input.priority),
        input.targetStartDate?.trim() || null,
        input.salaryMin ?? null,
        input.salaryMax ?? null,
        input.currencyCode?.trim().toUpperCase() ?? 'AED',
        input.description.trim(),
        input.requirements?.trim() || null,
        currentUser.userId,
      ],
    );

    return this.findJobRequisition(created!.id);
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

    await this.database.query(
      `
        UPDATE job_requisitions
        SET
          job_title = $2,
          department_id = $3,
          designation_id = $4,
          positions_count = $5,
          employment_type = $6,
          priority = $7,
          target_start_date = $8,
          salary_min = $9,
          salary_max = $10,
          currency_code = $11,
          description = $12,
          requirements = $13,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        input.jobTitle?.trim() ?? existing.jobTitle,
        departmentId,
        designationId,
        input.positionsCount ?? existing.positionsCount,
        input.employmentType !== undefined
          ? this.normalizeEmploymentType(input.employmentType)
          : existing.employmentType,
        input.priority !== undefined
          ? this.normalizePriority(input.priority)
          : existing.priority,
        input.targetStartDate !== undefined
          ? input.targetStartDate?.trim() || null
          : existing.targetStartDate,
        salaryMin,
        salaryMax,
        input.currencyCode?.trim().toUpperCase() ?? existing.currencyCode,
        input.description?.trim() ?? existing.description,
        input.requirements !== undefined
          ? input.requirements?.trim() || null
          : existing.requirements,
      ],
    );

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

    await this.database.query(
      `
        UPDATE job_requisitions
        SET
          status = $2,
          closed_at = CASE WHEN $2 IN ('FILLED', 'CLOSED') THEN NOW() ELSE NULL END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [input.id, status],
    );

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
    const duplicate = await this.database.one<{ id: string }>(
      `
        SELECT id
        FROM recruitment_applications
        WHERE requisition_id = $1 AND email = $2
      `,
      [input.requisitionId, email],
    );

    if (duplicate) {
      throw new ConflictException(
        'This candidate already has an application for the requisition',
      );
    }

    const created = await this.database.one<{ id: string }>(
      `
        INSERT INTO recruitment_applications (
          id,
          application_number,
          requisition_id,
          first_name,
          last_name,
          email,
          phone,
          source,
          years_experience,
          expected_salary,
          resume_url,
          notes,
          last_action_by_user_id,
          last_action_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING id
      `,
      [
        randomUUID(),
        this.generateRecordNumber('APP'),
        input.requisitionId,
        input.firstName.trim(),
        input.lastName.trim(),
        email,
        input.phone?.trim() || null,
        input.source?.trim() || null,
        input.yearsExperience ?? null,
        input.expectedSalary ?? null,
        input.resumeUrl?.trim() || null,
        input.notes?.trim() || null,
        currentUser.userId,
      ],
    );

    return this.findRecruitmentApplication(created!.id);
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
      const duplicate = await this.database.one<{ id: string }>(
        `
          SELECT id
          FROM recruitment_applications
          WHERE requisition_id = $1 AND email = $2 AND id <> $3
        `,
        [existing.requisitionId, email, input.id],
      );

      if (duplicate) {
        throw new ConflictException(
          'This candidate already has an application for the requisition',
        );
      }
    }

    await this.database.query(
      `
        UPDATE recruitment_applications
        SET
          first_name = $2,
          last_name = $3,
          email = $4,
          phone = $5,
          source = $6,
          years_experience = $7,
          expected_salary = $8,
          resume_url = $9,
          notes = $10,
          last_action_by_user_id = $11,
          last_action_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        input.firstName?.trim() ?? existing.firstName,
        input.lastName?.trim() ?? existing.lastName,
        email,
        input.phone !== undefined ? input.phone?.trim() || null : existing.phone,
        input.source !== undefined ? input.source?.trim() || null : existing.source,
        input.yearsExperience !== undefined
          ? input.yearsExperience
          : existing.yearsExperience,
        input.expectedSalary !== undefined
          ? input.expectedSalary
          : existing.expectedSalary,
        input.resumeUrl !== undefined
          ? input.resumeUrl?.trim() || null
          : existing.resumeUrl,
        input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
        currentUser.userId,
      ],
    );

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

    await this.database.query(
      `
        UPDATE recruitment_applications
        SET
          status = $2,
          decision_notes = $3,
          last_action_by_user_id = $4,
          last_action_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        status,
        input.decisionNotes?.trim() || existing.decisionNotes,
        currentUser.userId,
      ],
    );

    return this.findRecruitmentApplication(input.id);
  }

  private requisitionSelect() {
    return `
      SELECT
        jr.id,
        jr.requisition_number AS "requisitionNumber",
        jr.job_title AS "jobTitle",
        jr.department_id AS "departmentId",
        d.name AS "departmentName",
        jr.designation_id AS "designationId",
        des.title AS "designationTitle",
        jr.positions_count AS "positionsCount",
        jr.employment_type AS "employmentType",
        jr.priority,
        jr.status,
        jr.target_start_date::text AS "targetStartDate",
        jr.salary_min AS "salaryMin",
        jr.salary_max AS "salaryMax",
        jr.currency_code AS "currencyCode",
        jr.description,
        jr.requirements,
        COUNT(ra.id)::int AS "applicationCount",
        jr.opened_at::text AS "openedAt",
        jr.closed_at::text AS "closedAt",
        jr.created_at::text AS "createdAt"
      FROM job_requisitions jr
      INNER JOIN departments d ON d.id = jr.department_id
      LEFT JOIN designations des ON des.id = jr.designation_id
      LEFT JOIN recruitment_applications ra ON ra.requisition_id = jr.id
    `;
  }

  private requisitionGroupBy() {
    return `GROUP BY jr.id, d.name, des.title`;
  }

  private applicationSelect() {
    return `
      SELECT
        ra.id,
        ra.application_number AS "applicationNumber",
        ra.requisition_id AS "requisitionId",
        jr.requisition_number AS "requisitionNumber",
        jr.job_title AS "jobTitle",
        ra.first_name AS "firstName",
        ra.last_name AS "lastName",
        ra.email,
        ra.phone,
        ra.source,
        ra.years_experience AS "yearsExperience",
        ra.expected_salary AS "expectedSalary",
        ra.resume_url AS "resumeUrl",
        ra.status,
        ra.notes,
        ra.decision_notes AS "decisionNotes",
        ra.applied_at::text AS "appliedAt",
        ra.last_action_at::text AS "lastActionAt",
        CONCAT(u.first_name, ' ', u.last_name) AS "lastActionByName"
      FROM recruitment_applications ra
      INNER JOIN job_requisitions jr ON jr.id = ra.requisition_id
      LEFT JOIN users u ON u.id = ra.last_action_by_user_id
    `;
  }

  private async findJobRequisition(id: string) {
    const row = await this.database.one<JobRequisitionRow>(
      `
        ${this.requisitionSelect()}
        WHERE jr.id = $1
        ${this.requisitionGroupBy()}
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Job requisition not found');
    }

    return this.mapRequisition(row);
  }

  private async findRecruitmentApplication(id: string) {
    const row = await this.database.one<RecruitmentApplicationRow>(
      `
        ${this.applicationSelect()}
        WHERE ra.id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Recruitment application not found');
    }

    return this.mapApplication(row);
  }

  private async getRawRequisition(id: string) {
    const row = await this.database.one<{
      id: string;
      jobTitle: string;
      departmentId: string;
      designationId: string | null;
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
    }>(
      `
        SELECT
          id,
          job_title AS "jobTitle",
          department_id AS "departmentId",
          designation_id AS "designationId",
          positions_count AS "positionsCount",
          employment_type AS "employmentType",
          priority,
          status,
          target_start_date::text AS "targetStartDate",
          salary_min AS "salaryMin",
          salary_max AS "salaryMax",
          currency_code AS "currencyCode",
          description,
          requirements
        FROM job_requisitions
        WHERE id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Job requisition not found');
    }

    return row;
  }

  private async getRawApplication(id: string) {
    const row = await this.database.one<{
      id: string;
      requisitionId: string;
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
    }>(
      `
        SELECT
          id,
          requisition_id AS "requisitionId",
          first_name AS "firstName",
          last_name AS "lastName",
          email,
          phone,
          source,
          years_experience AS "yearsExperience",
          expected_salary AS "expectedSalary",
          resume_url AS "resumeUrl",
          status,
          notes,
          decision_notes AS "decisionNotes"
        FROM recruitment_applications
        WHERE id = $1
      `,
      [id],
    );

    if (!row) {
      throw new NotFoundException('Recruitment application not found');
    }

    return row;
  }

  private async assertDepartmentAndDesignation(
    departmentId: string,
    designationId?: string | null,
  ) {
    const department = await this.database.one<{ id: string }>(
      `SELECT id FROM departments WHERE id = $1 AND is_active = TRUE`,
      [departmentId],
    );

    if (!department) {
      throw new BadRequestException('Department not found or inactive');
    }

    if (!designationId) {
      return;
    }

    const designation = await this.database.one<{
      id: string;
      departmentId: string;
    }>(
      `
        SELECT id, department_id AS "departmentId"
        FROM designations
        WHERE id = $1 AND is_active = TRUE
      `,
      [designationId],
    );

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
