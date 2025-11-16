import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { Gender, MaritalStatus, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsUUID()
  departmentId: string;

  @IsUUID()
  designationId: string;

  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsDateString()
  joinDate: string;

  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @IsOptional()
  @IsString()
  currentAddress?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;
}
