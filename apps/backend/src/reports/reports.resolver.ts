import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { ReportsDashboardType } from './reports.types';
import { ReportsService } from './reports.service';

@UseGuards(GqlAuthGuard)
@Resolver(() => ReportsDashboardType)
export class ReportsResolver {
  constructor(private readonly reportsService: ReportsService) {}

  @Query(() => ReportsDashboardType, { name: 'reportsDashboard' })
  async reportsDashboard(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('periodMonth', { nullable: true }) periodMonth?: string,
  ) {
    return this.reportsService.dashboard(currentUser, periodMonth);
  }
}
