import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateDesignationInput,
  DeactivateDesignationInput,
  DesignationType,
  UpdateDesignationInput,
} from '../auth/auth.types';
import { DesignationService } from './designation.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  assertAccountManagerAccess,
  assertAdminPanelAccess,
} from '../common/access-control';

@UseGuards(GqlAuthGuard)
@Resolver(() => DesignationType)
export class DesignationResolver {
  constructor(private readonly designationService: DesignationService) {}

  @Query(() => [DesignationType], { name: 'designations' })
  async designations(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('departmentId', { nullable: true }) departmentId?: string,
    @Args('includeInactive', { type: () => Boolean, nullable: true })
    includeInactive?: boolean,
  ) {
    assertAdminPanelAccess(currentUser.roles);
    return this.designationService.findAll({
      departmentId,
      includeInactive: includeInactive ?? false,
    });
  }

  @Mutation(() => DesignationType, { name: 'createDesignation' })
  async createDesignation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateDesignationInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    return this.designationService.create(input);
  }

  @Mutation(() => DesignationType, { name: 'updateDesignation' })
  async updateDesignation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdateDesignationInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    return this.designationService.update(input);
  }

  @Mutation(() => DesignationType, { name: 'deactivateDesignation' })
  async deactivateDesignation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: DeactivateDesignationInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    return this.designationService.deactivate(input);
  }
}
