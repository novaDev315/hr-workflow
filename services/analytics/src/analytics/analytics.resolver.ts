import { Resolver, Query, Args } from '@nestjs/graphql';
import { AnalyticsService } from './analytics.service';

@Resolver('Analytics')
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Query()
  async employeeReport(@Args('filters') filters: any) {
    return this.analyticsService.generateEmployeeReport(filters);
  }

  @Query()
  async attendanceReport(@Args('filters') filters: any) {
    return this.analyticsService.generateAttendanceReport(filters);
  }

  @Query()
  async payrollReport(
    @Args('year', { type: () => Number }) year: number,
    @Args('month', { type: () => Number }) month: number,
  ) {
    return this.analyticsService.generatePayrollReport(year, month);
  }

  @Query()
  async leaveReport(@Args('filters') filters: any) {
    return this.analyticsService.generateLeaveReport(filters);
  }

  @Query()
  async recruitmentReport(@Args('filters') filters: any) {
    return this.analyticsService.generateRecruitmentReport(filters);
  }
}
