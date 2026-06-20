import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateDepartmentInput,
  DeactivateDepartmentInput,
  DepartmentType,
  UpdateDepartmentInput,
} from '../auth/auth.types';
import { DepartmentService } from './department.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import {
  assertAccountManagerAccess,
  assertAdminPanelAccess,
} from '../common/access-control';

@UseGuards(GqlAuthGuard)
@Resolver(() => DepartmentType)
export class DepartmentResolver {
  constructor(private readonly departmentService: DepartmentService) {}

  @Query(() => [DepartmentType], { name: 'departments' })
  async departments(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('includeInactive', { type: () => Boolean, nullable: true })
    includeInactive?: boolean,
  ) {
    assertAdminPanelAccess(currentUser.roles);
    return this.departmentService.findAll(includeInactive ?? false);
  }

  @Mutation(() => DepartmentType, { name: 'createDepartment' })
  async createDepartment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateDepartmentInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    return this.departmentService.create(input);
  }

  @Mutation(() => DepartmentType, { name: 'updateDepartment' })
  async updateDepartment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdateDepartmentInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    return this.departmentService.update(input);
  }

  @Mutation(() => DepartmentType, { name: 'deactivateDepartment' })
  async deactivateDepartment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: DeactivateDepartmentInput,
  ) {
    assertAccountManagerAccess(currentUser.roles);
    return this.departmentService.deactivate(input);
  }
}
