import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { RecruitmentService } from './recruitment.service';
import {
  AdvanceRecruitmentApplicationInput,
  ChangeJobRequisitionStatusInput,
  CreateJobRequisitionInput,
  CreateRecruitmentApplicationInput,
  JobRequisitionFilterInput,
  JobRequisitionType,
  RecruitmentApplicationFilterInput,
  RecruitmentApplicationType,
  RecruitmentSummaryType,
  UpdateJobRequisitionInput,
  UpdateRecruitmentApplicationInput,
} from './recruitment.types';

@UseGuards(GqlAuthGuard)
@Resolver(() => JobRequisitionType)
export class RecruitmentResolver {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Query(() => [JobRequisitionType], { name: 'jobRequisitions' })
  async jobRequisitions(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('filter', { nullable: true }) filter?: JobRequisitionFilterInput,
  ) {
    return this.recruitmentService.jobRequisitions(currentUser, filter);
  }

  @Query(() => JobRequisitionType, { name: 'jobRequisition' })
  async jobRequisition(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.recruitmentService.jobRequisition(currentUser, id);
  }

  @Query(() => [RecruitmentApplicationType], {
    name: 'recruitmentApplications',
  })
  async recruitmentApplications(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('filter', { nullable: true }) filter?: RecruitmentApplicationFilterInput,
  ) {
    return this.recruitmentService.recruitmentApplications(currentUser, filter);
  }

  @Query(() => RecruitmentSummaryType, { name: 'recruitmentSummary' })
  async recruitmentSummary(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.recruitmentService.recruitmentSummary(currentUser);
  }

  @Mutation(() => JobRequisitionType, { name: 'createJobRequisition' })
  async createJobRequisition(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateJobRequisitionInput,
  ) {
    return this.recruitmentService.createJobRequisition(currentUser, input);
  }

  @Mutation(() => JobRequisitionType, { name: 'updateJobRequisition' })
  async updateJobRequisition(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdateJobRequisitionInput,
  ) {
    return this.recruitmentService.updateJobRequisition(currentUser, input);
  }

  @Mutation(() => JobRequisitionType, { name: 'changeJobRequisitionStatus' })
  async changeJobRequisitionStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ChangeJobRequisitionStatusInput,
  ) {
    return this.recruitmentService.changeJobRequisitionStatus(
      currentUser,
      input,
    );
  }

  @Mutation(() => RecruitmentApplicationType, {
    name: 'createRecruitmentApplication',
  })
  async createRecruitmentApplication(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateRecruitmentApplicationInput,
  ) {
    return this.recruitmentService.createRecruitmentApplication(
      currentUser,
      input,
    );
  }

  @Mutation(() => RecruitmentApplicationType, {
    name: 'updateRecruitmentApplication',
  })
  async updateRecruitmentApplication(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpdateRecruitmentApplicationInput,
  ) {
    return this.recruitmentService.updateRecruitmentApplication(
      currentUser,
      input,
    );
  }

  @Mutation(() => RecruitmentApplicationType, {
    name: 'advanceRecruitmentApplication',
  })
  async advanceRecruitmentApplication(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: AdvanceRecruitmentApplicationInput,
  ) {
    return this.recruitmentService.advanceRecruitmentApplication(
      currentUser,
      input,
    );
  }
}
