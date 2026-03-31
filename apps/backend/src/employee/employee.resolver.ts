import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { EmployeeService } from './employee.service';
import {
  CreateEmployeeInput,
  EmployeeFilterInput,
  EmployeeType,
} from './employee.types';

@UseGuards(GqlAuthGuard)
@Resolver(() => EmployeeType)
export class EmployeeResolver {
  constructor(private readonly employeeService: EmployeeService) {}

  @Query(() => [EmployeeType], { name: 'employees' })
  async employees(
    @Args('filter', { nullable: true }) filter?: EmployeeFilterInput,
  ) {
    return this.employeeService.findAll(filter);
  }

  @Query(() => EmployeeType, { name: 'employee' })
  async employee(@Args('id', { type: () => ID }) id: string) {
    return this.employeeService.findOne(id);
  }

  @Mutation(() => EmployeeType, { name: 'createEmployee' })
  async createEmployee(@Args('input') input: CreateEmployeeInput) {
    return this.employeeService.create(input);
  }
}
