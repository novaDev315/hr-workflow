import {
  Field,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsString,
  IsOptional,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const DOCUMENT_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

/** Skips validation for null/undefined/empty so a document link can be cleared. */
const hasDocumentUrl = (input: { documentUrl?: string | null }) =>
  input.documentUrl !== undefined &&
  input.documentUrl !== null &&
  input.documentUrl.trim() !== '';

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
  documentOriginalName?: string | null;

  @Field({ nullable: true })
  documentMimeType?: string | null;

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
  @ValidateIf(hasDocumentUrl)
  @IsUrl(DOCUMENT_URL_OPTIONS, {
    message: 'must be a valid http or https URL',
  })
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
export class UpdatePolicyDocumentInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  version?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @Field({ nullable: true })
  @ValidateIf(hasDocumentUrl)
  @IsUrl(DOCUMENT_URL_OPTIONS, {
    message: 'must be a valid http or https URL',
  })
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

@InputType()
export class ArchivePolicyDocumentInput {
  @Field()
  @IsString()
  policyDocumentId: string;
}

@InputType()
export class UploadPolicyDocumentFileInput {
  @Field()
  @IsString()
  policyDocumentId: string;

  @Field()
  @IsString()
  @MaxLength(255)
  fileName: string;

  @Field()
  @IsString()
  @MaxLength(120)
  mimeType: string;

  @Field()
  @IsString()
  contentBase64: string;
}
