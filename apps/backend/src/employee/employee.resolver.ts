import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { EmployeeService } from './employee.service';
import {
  CreateEmployeeInput,
  DeactivateEmployeeInput,
  EmployeeFilterInput,
  EmployeeType,
  UpdateEmployeeInput,
} from './employee.types';

@UseGuards(GqlAuthGuard)
@Resolver(() => EmployeeType)
export class EmployeeResolver {
  constructor(private readonly employeeService: EmployeeService) {}

  @Query(() => [EmployeeType], { name: 'employees' })
  async employees(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('filter', { nullable: true }) filter?: EmployeeFilterInput,
  ) {
    return this.employeeService.findAll(currentUser, filter);
  }

  @Query(() => EmployeeType, { name: 'employee' })
  async employee(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.employeeService.findOne(currentUser, id);
  }

  @Mutation(() => EmployeeType, { name: 'createEmployee' })
  async createEmployee(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateEmployeeInput,
  ) {
    return this.employeeService.create(currentUser, input);
  }

  @Mutation(() => EmployeeType, { name: 'updateEmployee' })
  async updateEmployee(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdateEmployeeInput,
  ) {
    return this.employeeService.update(currentUser, input);
  }

  @Mutation(() => EmployeeType, { name: 'deactivateEmployee' })
  async deactivateEmployee(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: DeactivateEmployeeInput,
  ) {
    return this.employeeService.deactivate(currentUser, input);
  }
}
