import { Resolver, Query, Args } from '@nestjs/graphql';
import { DashboardService } from './dashboard.service';

@Resolver('Dashboard')
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query()
  async executiveDashboard() {
    return this.dashboardService.getExecutiveDashboard();
  }

  @Query()
  async recruitmentDashboard() {
    return this.dashboardService.getRecruitmentDashboard();
  }

  @Query()
  async attendanceTrends(
    @Args('days', { type: () => Number, defaultValue: 30 }) days: number,
  ) {
    return this.dashboardService.getAttendanceTrends(days);
  }

  @Query()
  async departmentAnalytics() {
    return this.dashboardService.getDepartmentAnalytics();
  }
}
