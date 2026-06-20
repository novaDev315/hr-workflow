import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  ArchivePolicyDocumentInput,
  CreatePolicyDocumentInput,
  PolicyDocumentType,
  PublishPolicyDocumentInput,
  UpdatePolicyDocumentInput,
  UploadPolicyDocumentFileInput,
} from './policy.types';
import { PolicyService } from './policy.service';

@UseGuards(GqlAuthGuard)
@Resolver(() => PolicyDocumentType)
export class PolicyResolver {
  constructor(private readonly policyService: PolicyService) {}

  @Query(() => [PolicyDocumentType], { name: 'policyDocuments' })
  async policyDocuments(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.policyService.policyDocuments(currentUser);
  }

  @Mutation(() => PolicyDocumentType, { name: 'createPolicyDocument' })
  async createPolicyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreatePolicyDocumentInput,
  ) {
    return this.policyService.createPolicyDocument(currentUser, input);
  }

  @Mutation(() => PolicyDocumentType, { name: 'updatePolicyDocument' })
  async updatePolicyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdatePolicyDocumentInput,
  ) {
    return this.policyService.updatePolicyDocument(currentUser, input);
  }

  @Mutation(() => PolicyDocumentType, { name: 'publishPolicyDocument' })
  async publishPolicyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: PublishPolicyDocumentInput,
  ) {
    return this.policyService.publishPolicyDocument(currentUser, input);
  }

  @Mutation(() => PolicyDocumentType, { name: 'archivePolicyDocument' })
  async archivePolicyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ArchivePolicyDocumentInput,
  ) {
    return this.policyService.archivePolicyDocument(currentUser, input);
  }

  @Mutation(() => PolicyDocumentType, { name: 'uploadPolicyDocumentFile' })
  async uploadPolicyDocumentFile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UploadPolicyDocumentFileInput,
  ) {
    return this.policyService.uploadPolicyDocumentFile(currentUser, input);
  }
}
