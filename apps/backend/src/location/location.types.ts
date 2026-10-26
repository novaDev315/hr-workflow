import {
  Field,
  Float,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
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
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Code can only use capital letters, numbers and underscores',
  })
  code: string;

  @Field(() => Float)
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude: number;

  @Field(() => Float)
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt({ message: 'Geofence radius must be a whole number of meters' })
  @Min(20, { message: 'Geofence radius must be between 20 and 5000 meters' })
  @Max(5000, { message: 'Geofence radius must be between 20 and 5000 meters' })
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
export class UpdateLocationInput {
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
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Code can only use capital letters, numbers and underscores',
  })
  code?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({}, { message: 'Latitude must be a number' })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({}, { message: 'Longitude must be a number' })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsInt({ message: 'Geofence radius must be a whole number of meters' })
  @Min(20, { message: 'Geofence radius must be between 20 and 5000 meters' })
  @Max(5000, { message: 'Geofence radius must be between 20 and 5000 meters' })
  geofenceRadius?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

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
export class DeactivateLocationInput {
  @Field(() => ID)
  @IsString()
  id: string;
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
