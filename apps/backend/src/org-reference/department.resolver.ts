import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateDepartmentInput, DepartmentType } from '../auth/auth.types';
import { DepartmentService } from './department.service';
import { GqlAuthGuard } from '../auth/gql-auth.guard';

@UseGuards(GqlAuthGuard)
@Resolver(() => DepartmentType)
export class DepartmentResolver {
  constructor(private readonly departmentService: DepartmentService) {}

  @Query(() => [DepartmentType], { name: 'departments' })
  async departments(
    @Args('includeInactive', { type: () => Boolean, nullable: true })
    includeInactive?: boolean,
  ) {
    return this.departmentService.findAll(includeInactive ?? false);
  }

  @Mutation(() => DepartmentType, { name: 'createDepartment' })
  async createDepartment(@Args('input') input: CreateDepartmentInput) {
    return this.departmentService.create(input);
  }
}
