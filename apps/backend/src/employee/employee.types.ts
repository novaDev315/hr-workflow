import {
  Field,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DepartmentType, DesignationType } from '../auth/auth.types';

@ObjectType()
export class EmployeeType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeNumber: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  fullName: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string | null;

  @Field()
  departmentId: string;

  @Field()
  designationId: string;

  @Field(() => DepartmentType)
  department: DepartmentType;

  @Field(() => DesignationType)
  designation: DesignationType;

  @Field({ nullable: true })
  supervisorId?: string | null;

  @Field({ nullable: true })
  supervisorName?: string | null;

  @Field()
  employmentType: string;

  @Field()
  joinDate: string;

  @Field({ nullable: true })
  exitDate?: string | null;

  @Field()
  status: string;

  @Field()
  isActive: boolean;

  @Field()
  hasLinkedAccount: boolean;

  @Field({ nullable: true })
  linkedAccountEmail?: string | null;

  @Field(() => [String])
  linkedAccountRoles: string[];
}

@InputType()
export class EmployeeFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}

@InputType()
export class CreateEmployeeInput {
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

  @Field()
  @IsString()
  departmentId: string;

  @Field()
  @IsString()
  designationId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  supervisorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(4)
  employmentType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  joinDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}
