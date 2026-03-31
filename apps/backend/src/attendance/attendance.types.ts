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
} from 'class-validator';

@ObjectType()
export class AttendanceEmployeeType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeNumber: string;

  @Field()
  fullName: string;
}

@ObjectType()
export class AttendanceLocationType {
  @Field(() => ID)
  id: string;

  @Field()
  code: string;

  @Field()
  name: string;
}

@ObjectType()
export class AttendanceRecordType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeId: string;

  @Field()
  locationId: string;

  @Field()
  attendanceDate: string;

  @Field({ nullable: true })
  clockInAt?: string | null;

  @Field({ nullable: true })
  clockOutAt?: string | null;

  @Field(() => Float, { nullable: true })
  clockInDistance?: number | null;

  @Field(() => Float, { nullable: true })
  clockOutDistance?: number | null;

  @Field(() => Float, { nullable: true })
  totalHours?: number | null;

  @Field(() => Float, { nullable: true })
  regularHours?: number | null;

  @Field(() => Float, { nullable: true })
  overtimeHours?: number | null;

  @Field()
  status: string;

  @Field(() => AttendanceEmployeeType)
  employee: AttendanceEmployeeType;

  @Field(() => AttendanceLocationType)
  location: AttendanceLocationType;
}

@InputType()
export class ClockInInput {
  @Field()
  @IsString()
  employeeId: string;

  @Field()
  @IsString()
  locationId: string;

  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

@InputType()
export class ClockOutInput {
  @Field()
  @IsString()
  employeeId: string;

  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

@InputType()
export class AttendanceFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locationId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  toDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}
