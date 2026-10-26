import {
  Field,
  Float,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType()
export class ReportsOverviewType {
  @Field(() => Int)
  activeEmployees: number;

  @Field(() => Int)
  pendingLeaveRequests: number;

  @Field(() => Int)
  processedPayrollPeriods: number;

  @Field(() => Int)
  publishedPolicies: number;

  @Field(() => Float)
  monthlyPayrollNetPay: number;
}

@ObjectType()
export class DepartmentHeadcountType {
  @Field()
  departmentName: string;

  @Field(() => Int)
  employeeCount: number;
}

@ObjectType()
export class RecentHireReportType {
  @Field()
  employeeNumber: string;

  @Field()
  fullName: string;

  @Field()
  joinDate: string;

  @Field()
  departmentName: string;

  @Field()
  designationTitle: string;
}

@ObjectType()
export class AttendanceSummaryReportType {
  @Field()
  employeeNumber: string;

  @Field()
  fullName: string;

  @Field(() => Float)
  attendanceDays: number;

  @Field(() => Float)
  overtimeHours: number;
}

@ObjectType()
export class PayrollDepartmentCostType {
  @Field()
  departmentName: string;

  @Field(() => Int)
  payslipCount: number;

  @Field(() => Float)
  totalNetPay: number;
}

@ObjectType()
export class PendingLeaveApprovalReportType {
  @Field()
  employeeNumber: string;

  @Field()
  fullName: string;

  @Field()
  leaveTypeName: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field(() => Float)
  totalDays: number;
}

@ObjectType()
export class PublishedPolicyReportType {
  @Field()
  title: string;

  @Field()
  category: string;

  @Field()
  version: string;

  @Field()
  effectiveDate: string;
}

@ObjectType()
export class ReportsDashboardType {
  @Field()
  accessScopeLabel: string;

  @Field()
  canViewPayroll: boolean;

  @Field(() => ReportsOverviewType)
  overview: ReportsOverviewType;

  @Field(() => [DepartmentHeadcountType])
  departmentHeadcount: DepartmentHeadcountType[];

  @Field(() => [RecentHireReportType])
  recentHires: RecentHireReportType[];

  @Field(() => [AttendanceSummaryReportType])
  attendanceSummary: AttendanceSummaryReportType[];

  @Field(() => [PayrollDepartmentCostType])
  payrollDepartmentCosts: PayrollDepartmentCostType[];

  @Field(() => [PendingLeaveApprovalReportType])
  pendingLeaveApprovals: PendingLeaveApprovalReportType[];

  @Field(() => [PublishedPolicyReportType])
  publishedPolicies: PublishedPolicyReportType[];
}
