import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

@ObjectType()
export class PayrollEmployeeType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeNumber: string;

  @Field()
  fullName: string;
}

@ObjectType()
export class EmployeeCompensationType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeId: string;

  @Field(() => Float)
  baseSalary: number;

  @Field(() => Float)
  allowanceAmount: number;

  @Field(() => Float)
  deductionAmount: number;

  @Field()
  currencyCode: string;

  @Field()
  effectiveFrom: string;

  @Field({ nullable: true })
  notes?: string | null;

  @Field(() => PayrollEmployeeType)
  employee: PayrollEmployeeType;
}

@ObjectType()
export class PayrollPeriodType {
  @Field(() => ID)
  id: string;

  @Field()
  periodMonth: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  processedAt?: string | null;

  @Field({ nullable: true })
  paidAt?: string | null;

  @Field(() => Int)
  payslipCount: number;

  @Field(() => Float)
  totalNetPay: number;
}

@ObjectType()
export class PayslipType {
  @Field(() => ID)
  id: string;

  @Field()
  payrollPeriodId: string;

  @Field()
  employeeId: string;

  @Field()
  periodMonth: string;

  @Field(() => Int)
  expectedWorkdays: number;

  @Field(() => Float)
  attendedDays: number;

  @Field(() => Float)
  approvedLeaveDays: number;

  @Field(() => Float)
  paidDays: number;

  @Field(() => Float)
  unpaidDays: number;

  @Field(() => Float)
  baseSalary: number;

  @Field(() => Float)
  proratedBaseSalary: number;

  @Field(() => Float)
  allowanceAmount: number;

  @Field(() => Float)
  deductionAmount: number;

  @Field(() => Float)
  attendanceDeduction: number;

  @Field(() => Float)
  grossPay: number;

  @Field(() => Float)
  netPay: number;

  @Field()
  currencyCode: string;

  @Field()
  status: string;

  @Field(() => PayrollEmployeeType)
  employee: PayrollEmployeeType;
}

@ObjectType()
export class PayrollPeriodPreviewType {
  @Field()
  periodMonth: string;

  @Field(() => Int)
  employeeCount: number;

  @Field(() => Int)
  missingCompensationCount: number;

  @Field(() => [String])
  missingCompensationNames: string[];

  @Field(() => Float)
  estimatedGross: number;

  @Field(() => Float)
  estimatedNet: number;

  @Field()
  currencyCode: string;

  @Field(() => [String])
  warnings: string[];
}

@InputType()
export class UpsertEmployeeCompensationInput {
  @Field()
  @IsString()
  employeeId: string;

  @Field(() => Float)
  @Min(0)
  baseSalary: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(0)
  allowanceAmount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(0)
  deductionAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

@InputType()
export class CreatePayrollPeriodInput {
  @Field()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodMonth: string;
}

@InputType()
export class ProcessPayrollPeriodInput {
  @Field()
  @IsString()
  payrollPeriodId: string;
}

@InputType()
export class MarkPayrollPeriodPaidInput {
  @Field()
  @IsString()
  payrollPeriodId: string;
}

@InputType()
export class DeletePayrollPeriodInput {
  @Field()
  @IsString()
  payrollPeriodId: string;
}

@InputType()
export class PayslipFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  payrollPeriodId?: string;
}
