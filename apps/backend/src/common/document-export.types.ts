import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DocumentExportType {
  @Field()
  fileName: string;

  @Field()
  mimeType: string;

  @Field()
  contentBase64: string;
}
