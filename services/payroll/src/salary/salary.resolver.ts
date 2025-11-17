import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { SalaryService } from './salary.service';

@Resolver('Salary')
export class SalaryResolver {
  constructor(private readonly salaryService: SalaryService) {}

  @Mutation()
  async createSalaryStructure(@Args('input') input: any) {
    return this.salaryService.createSalaryStructure(input);
  }

  @Query()
  async currentSalaryStructure(
    @Args('employeeId', { type: () => ID }) employeeId: string,
  ) {
    return this.salaryService.getCurrentSalaryStructure(employeeId);
  }

  @Query()
  async employeeSalaryHistory(
    @Args('employeeId', { type: () => ID }) employeeId: string,
  ) {
    return this.salaryService.getEmployeeSalaryHistory(employeeId);
  }

  @Mutation()
  async updateSalaryStructure(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('input') input: any,
  ) {
    return this.salaryService.updateSalaryStructure(structureId, input);
  }

  @Mutation()
  async deactivateSalaryStructure(
    @Args('structureId', { type: () => ID }) structureId: string,
    @Args('effectiveTo') effectiveTo: string,
  ) {
    return this.salaryService.deactivateSalaryStructure(
      structureId,
      effectiveTo,
    );
  }
}
