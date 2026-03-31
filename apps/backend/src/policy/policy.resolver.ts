import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  CreatePolicyDocumentInput,
  PolicyDocumentType,
  PublishPolicyDocumentInput,
} from './policy.types';
import { PolicyService } from './policy.service';

@UseGuards(GqlAuthGuard)
@Resolver(() => PolicyDocumentType)
export class PolicyResolver {
  constructor(private readonly policyService: PolicyService) {}

  @Query(() => [PolicyDocumentType], { name: 'policyDocuments' })
  async policyDocuments() {
    return this.policyService.policyDocuments();
  }

  @Mutation(() => PolicyDocumentType, { name: 'createPolicyDocument' })
  async createPolicyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreatePolicyDocumentInput,
  ) {
    return this.policyService.createPolicyDocument(currentUser, input);
  }

  @Mutation(() => PolicyDocumentType, { name: 'publishPolicyDocument' })
  async publishPolicyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: PublishPolicyDocumentInput,
  ) {
    return this.policyService.publishPolicyDocument(currentUser, input);
  }
}
