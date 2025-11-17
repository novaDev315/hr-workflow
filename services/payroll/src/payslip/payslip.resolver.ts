import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PayslipService } from './payslip.service';

@Resolver('Payslip')
export class PayslipResolver {
  constructor(private readonly payslipService: PayslipService) {}

  @Mutation()
  async generatePayslip(
    @Args('recordId', { type: () => ID }) recordId: string,
    @Args('employeeDetails', { nullable: true }) employeeDetails?: any,
  ) {
    return this.payslipService.generatePayslip(recordId, employeeDetails);
  }

  @Mutation()
  async bulkGeneratePayslips(
    @Args('periodId', { type: () => ID }) periodId: string,
  ) {
    return this.payslipService.bulkGeneratePayslips(periodId);
  }

  @Query()
  async payslipUrl(@Args('recordId', { type: () => ID }) recordId: string) {
    return this.payslipService.getPayslipUrl(recordId);
  }
}
