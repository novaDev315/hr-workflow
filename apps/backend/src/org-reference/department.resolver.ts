import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateDepartmentInput, DepartmentType } from '../auth/auth.types';
import { DepartmentService } from './department.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { assertAdminPanelAccess } from '../common/access-control';

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
    assertAdminPanelAccess(currentUser.roles);
    return this.departmentService.create(input);
  }
}
