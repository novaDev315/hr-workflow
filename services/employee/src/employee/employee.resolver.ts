import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';

@Resolver('Employee')
export class EmployeeResolver {
  constructor(private readonly employeeService: EmployeeService) {}

  @Query('employee')
  async employee(@Args('id', { type: () => ID }) id: string) {
    return this.employeeService.findOne(id);
  }

  @Query('employees')
  async employees(
    @Args('filter', { nullable: true }) filter?: any,
    @Args('pagination', { nullable: true }) pagination?: any,
  ) {
    return this.employeeService.findAll(filter, pagination);
  }

  @Mutation('createEmployee')
  async createEmployee(@Args('input') input: CreateEmployeeDto) {
    return this.employeeService.create(input);
  }

  @Mutation('updateEmployee')
  async updateEmployee(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(id, input);
  }

  @Mutation('deleteEmployee')
  async deleteEmployee(@Args('id', { type: () => ID }) id: string) {
    return this.employeeService.delete(id);
  }
}
