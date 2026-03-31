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
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

@ObjectType()
export class LocationType {
  @Field(() => ID)
  id: string;

  @Field()
  code: string;

  @Field()
  name: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field()
  geofenceRadius: number;

  @Field()
  address: string;

  @Field({ nullable: true })
  city?: string | null;

  @Field({ nullable: true })
  state?: string | null;

  @Field()
  country: string;

  @Field({ nullable: true })
  postalCode?: string | null;

  @Field({ nullable: true })
  landmark?: string | null;

  @Field()
  isActive: boolean;
}

@ObjectType()
export class EmployeeLocationAssignmentType {
  @Field(() => ID)
  id: string;

  @Field()
  employeeId: string;

  @Field()
  locationId: string;

  @Field()
  isPrimary: boolean;

  @Field()
  assignedDate: string;

  @Field({ nullable: true })
  releaseDate?: string | null;

  @Field()
  status: string;

  @Field(() => LocationType)
  location: LocationType;
}

@InputType()
export class CreateLocationInput {
  @Field()
  @IsString()
  @MaxLength(120)
  name: string;

  @Field()
  @Matches(/^[A-Z0-9_]+$/)
  code: string;

  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;

  @Field({ nullable: true })
  @IsOptional()
  @Min(20)
  geofenceRadius?: number;

  @Field()
  @IsString()
  @MaxLength(255)
  address: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  postalCode?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;
}

@InputType()
export class AssignEmployeeLocationInput {
  @Field()
  @IsString()
  employeeId: string;

  @Field()
  @IsString()
  locationId: string;

  @Field({ nullable: true })
  @IsOptional()
  isPrimary?: boolean;
}
