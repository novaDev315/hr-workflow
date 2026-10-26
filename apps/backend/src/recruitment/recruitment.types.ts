import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPES,
  normalizeEnumInput,
  REQUISITION_PRIORITIES,
  REQUISITION_STATUSES,
} from './recruitment.constants';

const oneOf = (label: string, values: readonly string[]) => ({
  message: `${label} must be one of: ${values.join(', ')}`,
});

@ObjectType()
export class JobRequisitionType {
  @Field(() => ID)
  id: string;

  @Field()
  requisitionNumber: string;

  @Field()
  jobTitle: string;

  @Field()
  departmentId: string;

  @Field()
  departmentName: string;

  @Field({ nullable: true })
  designationId?: string | null;

  @Field({ nullable: true })
  designationTitle?: string | null;

  @Field(() => Int)
  positionsCount: number;

  @Field()
  employmentType: string;

  @Field()
  priority: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  targetStartDate?: string | null;

  @Field(() => Float, { nullable: true })
  salaryMin?: number | null;

  @Field(() => Float, { nullable: true })
  salaryMax?: number | null;

  @Field()
  currencyCode: string;

  @Field()
  description: string;

  @Field({ nullable: true })
  requirements?: string | null;

  @Field(() => Int)
  applicationCount: number;

  @Field()
  openedAt: string;

  @Field({ nullable: true })
  closedAt?: string | null;

  @Field()
  createdAt: string;
}

@ObjectType()
export class RecruitmentApplicationType {
  @Field(() => ID)
  id: string;

  @Field()
  applicationNumber: string;

  @Field()
  requisitionId: string;

  @Field()
  requisitionNumber: string;

  @Field()
  jobTitle: string;

  @Field()
  candidateName: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string | null;

  @Field({ nullable: true })
  source?: string | null;

  @Field(() => Float, { nullable: true })
  yearsExperience?: number | null;

  @Field(() => Float, { nullable: true })
  expectedSalary?: number | null;

  @Field({ nullable: true })
  resumeUrl?: string | null;

  @Field()
  status: string;

  @Field({ nullable: true })
  notes?: string | null;

  @Field({ nullable: true })
  decisionNotes?: string | null;

  @Field()
  appliedAt: string;

  @Field({ nullable: true })
  lastActionAt?: string | null;

  @Field({ nullable: true })
  lastActionByName?: string | null;
}

@ObjectType()
export class RecruitmentSummaryType {
  @Field(() => Int)
  openRequisitions: number;

  @Field(() => Int)
  activeApplications: number;

  @Field(() => Int)
  screeningApplications: number;

  @Field(() => Int)
  selectedApplications: number;
}

@InputType()
export class JobRequisitionFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(normalizeEnumInput)
  @IsIn([...REQUISITION_STATUSES], oneOf('status', REQUISITION_STATUSES))
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string;
}

@InputType()
export class RecruitmentApplicationFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  requisitionId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Transform(normalizeEnumInput)
  @IsIn([...APPLICATION_STATUSES], oneOf('status', APPLICATION_STATUSES))
  status?: string;
}

@InputType()
export class CreateJobRequisitionInput {
  @Field()
  @IsString()
  @MaxLength(140)
  jobTitle: string;

  @Field()
  @IsString()
  departmentId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  designationId?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  positionsCount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(normalizeEnumInput)
  @IsIn([...EMPLOYMENT_TYPES], oneOf('employmentType', EMPLOYMENT_TYPES))
  employmentType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(normalizeEnumInput)
  @IsIn([...REQUISITION_PRIORITIES], oneOf('priority', REQUISITION_PRIORITIES))
  priority?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetStartDate?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @Field()
  @IsString()
  @MaxLength(1000)
  description: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirements?: string;
}

@InputType()
export class UpdateJobRequisitionInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  jobTitle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  designationId?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  positionsCount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(normalizeEnumInput)
  @IsIn([...EMPLOYMENT_TYPES], oneOf('employmentType', EMPLOYMENT_TYPES))
  employmentType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(normalizeEnumInput)
  @IsIn([...REQUISITION_PRIORITIES], oneOf('priority', REQUISITION_PRIORITIES))
  priority?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  targetStartDate?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirements?: string;
}

@InputType()
export class ChangeJobRequisitionStatusInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field()
  @IsString()
  @Transform(normalizeEnumInput)
  @IsIn([...REQUISITION_STATUSES], oneOf('status', REQUISITION_STATUSES))
  status: string;
}

@InputType()
export class CreateRecruitmentApplicationInput {
  @Field()
  @IsString()
  requisitionId: string;

  @Field()
  @IsString()
  @MaxLength(80)
  firstName: string;

  @Field()
  @IsString()
  @MaxLength(80)
  lastName: string;

  @Field()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsExperience?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedSalary?: number;

  @Field({ nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null && String(value).trim() !== '')
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'resumeUrl must be a valid http:// or https:// URL' },
  )
  @MaxLength(1000)
  resumeUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

@InputType()
export class UpdateRecruitmentApplicationInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsExperience?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedSalary?: number;

  @Field({ nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null && String(value).trim() !== '')
  @IsString()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'resumeUrl must be a valid http:// or https:// URL' },
  )
  @MaxLength(1000)
  resumeUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

@InputType()
export class AdvanceRecruitmentApplicationInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field()
  @IsString()
  @Transform(normalizeEnumInput)
  @IsIn([...APPLICATION_STATUSES], oneOf('status', APPLICATION_STATUSES))
  status: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNotes?: string;
}
