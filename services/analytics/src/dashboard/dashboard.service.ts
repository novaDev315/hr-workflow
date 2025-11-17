import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { subDays, startOfMonth, endOfMonth, format } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private readonly httpService: HttpService) {}

  /**
   * Get executive dashboard data
   */
  async getExecutiveDashboard() {
    // Fetch data from various services
    const [employeeStats, attendanceStats, leaveStats, payrollStats] = await Promise.all([
      this.getEmployeeStatistics(),
      this.getAttendanceStatistics(),
      this.getLeaveStatistics(),
      this.getPayrollStatistics(),
    ]);

    return {
      employees: employeeStats,
      attendance: attendanceStats,
      leave: leaveStats,
      payroll: payrollStats,
      timestamp: new Date(),
    };
  }

  /**
   * Get employee statistics
   */
  private async getEmployeeStatistics() {
    // Mock data - in production, call Employee Service
    return {
      total: 247,
      active: 235,
      onLeave: 8,
      newHires: 12,
      attrition: 3.2,
      departmentBreakdown: [
        { department: 'Engineering', count: 85 },
        { department: 'Sales', count: 62 },
        { department: 'Operations', count: 48 },
        { department: 'HR', count: 18 },
        { department: 'Finance', count: 34 },
      ],
    };
  }

  /**
   * Get attendance statistics
   */
  private async getAttendanceStatistics() {
    const today = new Date();
    const thisMonth = startOfMonth(today);

    return {
      today: {
        present: 235,
        absent: 4,
        onLeave: 8,
        percentage: 95.1,
      },
      thisMonth: {
        avgAttendance: 94.8,
        totalDays: format(today, 'd'),
        overtimeHours: 342,
      },
      lateArrivals: 23,
      earlyDepartures: 15,
    };
  }

  /**
   * Get leave statistics
   */
  private async getLeaveStatistics() {
    return {
      pending: 18,
      approved: 156,
      rejected: 12,
      thisMonth: 45,
      byType: [
        { type: 'Casual Leave', count: 89 },
        { type: 'Sick Leave', count: 45 },
        { type: 'Earned Leave', count: 34 },
      ],
    };
  }

  /**
   * Get payroll statistics
   */
  private async getPayrollStatistics() {
    const currentMonth = format(new Date(), 'MMMM yyyy');

    return {
      currentMonth: {
        period: currentMonth,
        totalEmployees: 247,
        grossSalary: 12450000,
        deductions: 1245000,
        netSalary: 11205000,
        status: 'Processed',
      },
      ytd: {
        totalPaid: 134655000,
        avgSalary: 45380,
      },
    };
  }

  /**
   * Get recruitment dashboard
   */
  async getRecruitmentDashboard() {
    return {
      activeOpenings: 15,
      totalApplications: 342,
      shortlisted: 45,
      interviewing: 23,
      offered: 8,
      joined: 5,
      conversionRate: 1.5,
      avgTimeToHire: 28, // days
      topSources: [
        { source: 'Employee Referral', count: 89 },
        { source: 'Job Portal', count: 145 },
        { source: 'Career Site', count: 67 },
        { source: 'Campus', count: 41 },
      ],
    };
  }

  /**
   * Get attendance trends
   */
  async getAttendanceTrends(days: number = 30) {
    const trends = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      trends.push({
        date: format(date, 'yyyy-MM-dd'),
        present: Math.floor(Math.random() * 10) + 230,
        absent: Math.floor(Math.random() * 5) + 2,
        onLeave: Math.floor(Math.random() * 8) + 5,
      });
    }

    return trends;
  }

  /**
   * Get department-wise analytics
   */
  async getDepartmentAnalytics() {
    return [
      {
        department: 'Engineering',
        employees: 85,
        avgAttendance: 95.2,
        leaveBalance: 12.5,
        avgSalary: 65000,
      },
      {
        department: 'Sales',
        employees: 62,
        avgAttendance: 93.8,
        leaveBalance: 10.2,
        avgSalary: 55000,
      },
      {
        department: 'Operations',
        employees: 48,
        avgAttendance: 96.1,
        leaveBalance: 11.8,
        avgSalary: 42000,
      },
    ];
  }
}
