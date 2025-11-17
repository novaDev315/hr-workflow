import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ApprovalService } from './approval.service';

@Resolver('LeaveApproval')
export class ApprovalResolver {
  constructor(private readonly approvalService: ApprovalService) {}

  @Mutation()
  async leaveL1Review(
    @Args('applicationId', { type: () => ID }) applicationId: string,
    @Args('reviewerId', { type: () => ID }) reviewerId: string,
    @Args('action') action: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED',
    @Args('notes', { nullable: true }) notes?: string,
  ) {
    return this.approvalService.level1Review(applicationId, reviewerId, action, notes);
  }

  @Mutation()
  async leaveL2Approval(
    @Args('applicationId', { type: () => ID }) applicationId: string,
    @Args('approverId', { type: () => ID }) approverId: string,
    @Args('action') action: 'APPROVED' | 'REJECTED',
    @Args('notes', { nullable: true }) notes?: string,
  ) {
    return this.approvalService.level2Approval(applicationId, approverId, action, notes);
  }

  @Mutation()
  async leaveL3Verification(
    @Args('applicationId', { type: () => ID }) applicationId: string,
    @Args('verifierId', { type: () => ID }) verifierId: string,
    @Args('action') action: 'APPROVED' | 'REJECTED',
    @Args('notes', { nullable: true }) notes?: string,
  ) {
    return this.approvalService.level3Verification(applicationId, verifierId, action, notes);
  }

  @Mutation()
  async bulkApproveLeave(
    @Args('applicationIds', { type: () => [ID] }) applicationIds: string[],
    @Args('level', { type: () => Number }) level: 1 | 2 | 3,
    @Args('approverId', { type: () => ID }) approverId: string,
    @Args('notes', { nullable: true }) notes?: string,
  ) {
    return this.approvalService.bulkApprove(applicationIds, level, approverId, notes);
  }

  @Query()
  async pendingLeaveApprovals(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('level', { type: () => Number }) level: 1 | 2 | 3,
  ) {
    return this.approvalService.getPendingApprovals(userId, level);
  }

  @Query()
  async leaveApprovalHistory(@Args('applicationId', { type: () => ID }) applicationId: string) {
    return this.approvalService.getApprovalHistory(applicationId);
  }
}
