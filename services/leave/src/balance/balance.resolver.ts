import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { BalanceService } from './balance.service';

@Resolver('LeaveBalance')
export class BalanceResolver {
  constructor(private readonly balanceService: BalanceService) {}

  @Query()
  async leaveBalance(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('leaveTypeId', { type: () => ID }) leaveTypeId: string,
    @Args('year', { type: () => Number }) year: number,
  ) {
    return this.balanceService.getBalance(employeeId, leaveTypeId, year);
  }

  @Query()
  async employeeLeaveBalances(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('year', { type: () => Number }) year: number,
  ) {
    return this.balanceService.getAllBalances(employeeId, year);
  }

  @Query()
  async leaveBalanceSummary(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('year', { type: () => Number }) year: number,
  ) {
    return this.balanceService.getBalanceSummary(employeeId, year);
  }

  @Mutation()
  async processMonthlyAccrual(
    @Args('year', { type: () => Number }) year: number,
    @Args('month', { type: () => Number }) month: number,
  ) {
    return this.balanceService.processMonthlyAccrual(year, month);
  }
}
