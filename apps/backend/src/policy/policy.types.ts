import {
  Field,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

@ObjectType()
export class PolicyDocumentType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  category: string;

  @Field()
  version: string;

  @Field()
  effectiveDate: string;

  @Field()
  description: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  documentUrl?: string | null;

  @Field({ nullable: true })
  content?: string | null;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  publishedAt?: string | null;
}

@InputType()
export class CreatePolicyDocumentInput {
  @Field()
  @IsString()
  @MaxLength(160)
  title: string;

  @Field()
  @IsString()
  @MaxLength(80)
  category: string;

  @Field()
  @IsString()
  @MaxLength(30)
  version: string;

  @Field()
  @IsString()
  effectiveDate: string;

  @Field()
  @IsString()
  @MaxLength(500)
  description: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  documentUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

@InputType()
export class PublishPolicyDocumentInput {
  @Field()
  @IsString()
  policyDocumentId: string;
}
