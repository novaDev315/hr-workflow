import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { LeaveService } from './leave.service';

@Resolver('Leave')
export class LeaveResolver {
  constructor(private readonly leaveService: LeaveService) {}

  @Mutation()
  async applyLeave(
    @Args('input') input: any,
  ) {
    return this.leaveService.applyLeave(input);
  }

  @Query()
  async leaveApplication(@Args('id', { type: () => ID }) id: string) {
    return this.leaveService.getApplication(id);
  }

  @Query()
  async employeeLeaveApplications(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('year', { type: () => Number, nullable: true }) year?: number,
  ) {
    return this.leaveService.getEmployeeApplications(employeeId, year);
  }

  @Mutation()
  async cancelLeaveApplication(
    @Args('id', { type: () => ID }) id: string,
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('reason') reason: string,
  ) {
    return this.leaveService.cancelApplication(id, employeeId, reason);
  }

  @Query()
  async leaveTypes() {
    return this.leaveService.getLeaveTypes();
  }

  @Mutation()
  async createLeaveType(@Args('input') input: any) {
    return this.leaveService.createLeaveType(input);
  }

  @Query()
  async leaveStatistics(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('year', { type: () => Number }) year: number,
  ) {
    return this.leaveService.getLeaveStatistics(employeeId, year);
  }
}
