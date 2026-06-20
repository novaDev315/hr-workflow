import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { LeaveService } from './leave.service';
import {
  CreateLeaveTypeInput,
  DeactivateLeaveTypeInput,
  LeaveBalanceType,
  LeaveRequestFilterInput,
  LeaveRequestType,
  LeaveTypeType,
  RequestLeaveInput,
  ReviewLeaveRequestInput,
  UpdateLeaveTypeInput,
} from './leave.types';

@UseGuards(GqlAuthGuard)
@Resolver(() => LeaveRequestType)
export class LeaveResolver {
  constructor(private readonly leaveService: LeaveService) {}

  @Query(() => [LeaveTypeType], { name: 'leaveTypes' })
  async leaveTypes() {
    return this.leaveService.leaveTypes();
  }

  @Query(() => [LeaveRequestType], { name: 'leaveRequests' })
  async leaveRequests(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('filter', { nullable: true }) filter?: LeaveRequestFilterInput,
  ) {
    return this.leaveService.leaveRequests(currentUser, filter);
  }

  @Query(() => [LeaveBalanceType], { name: 'leaveBalances' })
  async leaveBalances(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('employeeId', { type: () => ID }) employeeId: string,
  ) {
    return this.leaveService.leaveBalances(currentUser, employeeId);
  }

  @Mutation(() => LeaveTypeType, { name: 'createLeaveType' })
  async createLeaveType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateLeaveTypeInput,
  ) {
    return this.leaveService.createLeaveType(currentUser, input);
  }

  @Mutation(() => LeaveTypeType, { name: 'updateLeaveType' })
  async updateLeaveType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdateLeaveTypeInput,
  ) {
    return this.leaveService.updateLeaveType(currentUser, input);
  }

  @Mutation(() => LeaveTypeType, { name: 'deactivateLeaveType' })
  async deactivateLeaveType(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: DeactivateLeaveTypeInput,
  ) {
    return this.leaveService.deactivateLeaveType(currentUser, input);
  }

  @Mutation(() => LeaveRequestType, { name: 'requestLeave' })
  async requestLeave(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: RequestLeaveInput,
  ) {
    return this.leaveService.requestLeave(currentUser, input);
  }

  @Mutation(() => LeaveRequestType, { name: 'reviewLeaveRequest' })
  async reviewLeaveRequest(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ReviewLeaveRequestInput,
  ) {
    return this.leaveService.reviewLeaveRequest(currentUser, input);
  }
}
