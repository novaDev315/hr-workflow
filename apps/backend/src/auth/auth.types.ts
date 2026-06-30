import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

@ObjectType()
export class AccountProfileType {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  fullName: string;

  @Field()
  isActive: boolean;

  @Field(() => [String])
  roles: string[];

  @Field()
  canAccessAdminPanel: boolean;

  @Field()
  canManageAccounts: boolean;

  @Field({ nullable: true })
  employeeId?: string | null;

  @Field({ nullable: true })
  employeeNumber?: string | null;

  @Field({ nullable: true })
  departmentName?: string | null;

  @Field({ nullable: true })
  designationTitle?: string | null;

  @Field({ nullable: true })
  employeeStatus?: string | null;
}

@ObjectType()
export class AccountSessionType {
  @Field()
  accessToken: string;

  @Field()
  expiresIn: string;

  @Field(() => AccountProfileType)
  account: AccountProfileType;
}

@ObjectType()
export class AuthBootstrapStatusType {
  @Field()
  bootstrapRequired: boolean;

  @Field(() => Int)
  accountCount: number;
}

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @MinLength(8)
  password: string;
}

@InputType()
export class CreateEmployeeAccountInput {
  @Field()
  @IsString()
  employeeId: string;

  @Field()
  @MinLength(8)
  password: string;
}

@InputType()
export class ProvisionStaffAccessInput {
  @Field()
  @IsString()
  employeeId: string;

  @Field()
  @IsString()
  @MaxLength(20)
  roleKey: string;

  @Field({ nullable: true })
  @IsOptional()
  @MinLength(8)
  password?: string;
}

@InputType()
export class BootstrapAdminInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @MinLength(8)
  password: string;

  @Field()
  @IsString()
  @MaxLength(60)
  firstName: string;

  @Field()
  @IsString()
  @MaxLength(60)
  lastName: string;
}

@ObjectType()
export class DepartmentType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  code: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  isActive: boolean;
}

@ObjectType()
export class DesignationType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  code: string;

  @Field()
  departmentId: string;

  @Field(() => DepartmentType)
  department: DepartmentType;

  @Field(() => Int)
  level: number;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  isActive: boolean;
}

@ObjectType()
export class CompanySettingsType {
  @Field(() => ID)
  id: string;

  @Field()
  companyName: string;

  @Field({ nullable: true })
  legalName?: string | null;

  @Field()
  timezone: string;

  @Field()
  currencyCode: string;

  @Field()
  countryCode: string;

  @Field({ nullable: true })
  supportEmail?: string | null;

  @Field({ nullable: true })
  supportPhone?: string | null;
}

@InputType()
export class CreateDepartmentInput {
  @Field()
  @IsString()
  @MaxLength(120)
  name: string;

  @Field()
  @Matches(/^[A-Z0-9_]+$/)
  code: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

@InputType()
export class UpdateDepartmentInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^[A-Z0-9_]+$/)
  code?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

@InputType()
export class DeactivateDepartmentInput {
  @Field(() => ID)
  @IsString()
  id: string;
}

@InputType()
export class CreateDesignationInput {
  @Field()
  @IsString()
  @MaxLength(120)
  title: string;

  @Field()
  @Matches(/^[A-Z0-9_]+$/)
  code: string;

  @Field()
  @IsString()
  departmentId: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  level?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

@InputType()
export class UpdateDesignationInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^[A-Z0-9_]+$/)
  code?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  level?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

@InputType()
export class DeactivateDesignationInput {
  @Field(() => ID)
  @IsString()
  id: string;
}

@InputType()
export class UpsertCompanySettingsInput {
  @Field()
  @IsString()
  @MaxLength(160)
  companyName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  supportPhone?: string;
}
