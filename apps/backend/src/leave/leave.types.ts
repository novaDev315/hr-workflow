import {
  Field,
  Float,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

@ObjectType()
export class LeaveTypeType {
  @Field(() => ID)
  id: string;

  @Field()
  code: string;

  @Field()
  name: string;

  @Field(() => Float)
  @IsNumber()
  defaultDays: number;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  isActive: boolean;
}

@ObjectType()
export class LeaveEmployeeType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeNumber: string;

  @Field()
  fullName: string;
}

@ObjectType()
export class LeaveBalanceType {
  @Field(() => ID)
  leaveTypeId: string;

  @Field(() => LeaveTypeType)
  leaveType: LeaveTypeType;

  @Field(() => Float)
  allocatedDays: number;

  @Field(() => Float)
  usedDays: number;

  @Field(() => Float)
  availableDays: number;
}

@ObjectType()
export class LeaveRequestType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeId: string;

  @Field()
  leaveTypeId: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field(() => Float)
  totalDays: number;

  @Field()
  status: string;

  @Field()
  reason: string;

  @Field()
  requestedAt: string;

  @Field({ nullable: true })
  decidedAt?: string | null;

  @Field({ nullable: true })
  reviewedByName?: string | null;

  @Field({ nullable: true })
  decisionNotes?: string | null;

  @Field(() => LeaveEmployeeType)
  employee: LeaveEmployeeType;

  @Field(() => LeaveTypeType)
  leaveType: LeaveTypeType;
}

@InputType()
export class CreateLeaveTypeInput {
  @Field()
  @IsString()
  @MaxLength(20)
  code: string;

  @Field()
  @IsString()
  @MaxLength(120)
  name: string;

  @Field(() => Float)
  @IsNumber()
  defaultDays: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

@InputType()
export class RequestLeaveInput {
  @Field()
  @IsString()
  employeeId: string;

  @Field()
  @IsString()
  leaveTypeId: string;

  @Field()
  @IsString()
  startDate: string;

  @Field()
  @IsString()
  endDate: string;

  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

@InputType()
export class ReviewLeaveRequestInput {
  @Field()
  @IsString()
  requestId: string;

  @Field()
  @IsString()
  status: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionNotes?: string;
}

@InputType()
export class LeaveRequestFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  toDate?: string;
}
