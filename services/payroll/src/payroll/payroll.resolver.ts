import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PayrollService } from './payroll.service';

@Resolver('Payroll')
export class PayrollResolver {
  constructor(private readonly payrollService: PayrollService) {}

  @Mutation()
  async createPayrollPeriod(
    @Args('year', { type: () => Number }) year: number,
    @Args('month', { type: () => Number }) month: number,
  ) {
    return this.payrollService.createPayrollPeriod(year, month);
  }

  @Mutation()
  async processPayroll(
    @Args('periodId', { type: () => ID }) periodId: string,
    @Args('processedBy', { type: () => ID }) processedBy: string,
  ) {
    return this.payrollService.processPayroll(periodId, processedBy);
  }

  @Mutation()
  async processEmployeePayroll(
    @Args('periodId', { type: () => ID }) periodId: string,
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('year', { type: () => Number }) year: number,
    @Args('month', { type: () => Number }) month: number,
  ) {
    return this.payrollService.processEmployeePayroll(
      periodId,
      employeeId,
      year,
      month,
    );
  }

  @Mutation()
  async applyPayrollOverride(
    @Args('recordId', { type: () => ID }) recordId: string,
    @Args('overriddenBy', { type: () => ID }) overriddenBy: string,
    @Args('overrides') overrides: any[],
  ) {
    return this.payrollService.applyOverride(recordId, overriddenBy, overrides);
  }

  @Query()
  async payrollRecords(@Args('periodId', { type: () => ID }) periodId: string) {
    return this.payrollService.getPayrollRecords(periodId);
  }

  @Query()
  async employeePayrollHistory(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('year', { type: () => Number, nullable: true }) year?: number,
  ) {
    return this.payrollService.getEmployeePayrollHistory(employeeId, year);
  }

  @Mutation()
  async approvePayrollPeriod(
    @Args('periodId', { type: () => ID }) periodId: string,
    @Args('approvedBy', { type: () => ID }) approvedBy: string,
  ) {
    return this.payrollService.approvePayrollPeriod(periodId, approvedBy);
  }

  @Mutation()
  async lockPayrollPeriod(
    @Args('periodId', { type: () => ID }) periodId: string,
    @Args('lockedBy', { type: () => ID }) lockedBy: string,
  ) {
    return this.payrollService.lockPayrollPeriod(periodId, lockedBy);
  }
}
