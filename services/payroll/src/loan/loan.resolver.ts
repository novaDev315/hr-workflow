import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { LoanService } from './loan.service';

@Resolver('Loan')
export class LoanResolver {
  constructor(private readonly loanService: LoanService) {}

  @Mutation()
  async applyLoan(@Args('input') input: any) {
    return this.loanService.applyLoan(input);
  }

  @Mutation()
  async approveLoan(
    @Args('loanId', { type: () => ID }) loanId: string,
    @Args('approvedBy', { type: () => ID }) approvedBy: string,
  ) {
    return this.loanService.approveLoan(loanId, approvedBy);
  }

  @Mutation()
  async rejectLoan(@Args('loanId', { type: () => ID }) loanId: string) {
    return this.loanService.rejectLoan(loanId);
  }

  @Mutation()
  async processEMIPayment(
    @Args('loanId', { type: () => ID }) loanId: string,
    @Args('paidAmount', { type: () => Number }) paidAmount: number,
  ) {
    return this.loanService.processEMIPayment(loanId, paidAmount);
  }

  @Query()
  async employeeLoans(@Args('employeeId', { type: () => ID }) employeeId: string) {
    return this.loanService.getEmployeeLoans(employeeId);
  }

  @Query()
  async activeLoan(@Args('employeeId', { type: () => ID }) employeeId: string) {
    return this.loanService.getActiveLoan(employeeId);
  }

  @Query()
  async loanDetails(@Args('loanId', { type: () => ID }) loanId: string) {
    return this.loanService.getLoanDetails(loanId);
  }

  @Mutation()
  async cancelLoan(@Args('loanId', { type: () => ID }) loanId: string) {
    return this.loanService.cancelLoan(loanId);
  }
}
