import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { CalendarService } from '../calendar/calendar.service';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
    private readonly calendarService: CalendarService,
  ) {}

  /**
   * Generate unique leave application number
   */
  private async generateApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = 'LV';

    const lastApplication = await this.prisma.leaveApplication.findFirst({
      where: {
        applicationNumber: {
          startsWith: `${prefix}${year}`,
        },
      },
      orderBy: {
        applicationNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastApplication) {
      const lastSequence = parseInt(
        lastApplication.applicationNumber.slice(-5),
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${sequence.toString().padStart(5, '0')}`;
  }

  /**
   * Calculate working days between two dates
   */
  private async calculateWorkingDays(
    startDate: Date,
    endDate: Date,
    halfDayType?: string,
  ): Promise<number> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let workingDays = 0;
    let currentDate = start;

    while (currentDate <= end) {
      const isWorkingDay = await this.calendarService.isWorkingDay(currentDate);
      if (isWorkingDay) {
        workingDays++;
      }
      currentDate = addDays(currentDate, 1);
    }

    // Handle half day
    if (halfDayType) {
      return workingDays - 0.5;
    }

    return workingDays;
  }

  /**
   * Apply for leave
   */
  async applyLeave(data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    halfDayType?: string;
    emergencyContact?: string;
    documentUrl?: string;
  }) {
    const startDate = parseISO(data.startDate);
    const endDate = parseISO(data.endDate);

    // Validate dates
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Calculate working days
    const totalDays = await this.calculateWorkingDays(
      startDate,
      endDate,
      data.halfDayType,
    );

    if (totalDays <= 0) {
      throw new BadRequestException('Leave must include at least one working day');
    }

    // Get leave type and policy
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: data.leaveTypeId },
      include: { policies: { where: { isActive: true } } },
    });

    if (!leaveType || !leaveType.isActive) {
      throw new NotFoundException('Leave type not found or inactive');
    }

    // Check balance
    const year = startDate.getFullYear();
    const balance = await this.balanceService.getBalance(
      data.employeeId,
      data.leaveTypeId,
      year,
    );

    if (balance.available < totalDays) {
      throw new BadRequestException(
        `Insufficient leave balance. Available: ${balance.available}, Requested: ${totalDays}`,
      );
    }

    // Check for overlapping leave
    const overlapping = await this.prisma.leaveApplication.findFirst({
      where: {
        employeeId: data.employeeId,
        status: {
          in: ['PENDING', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3', 'APPROVED'],
        },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Leave dates overlap with existing application',
      );
    }

    // Generate application number
    const applicationNumber = await this.generateApplicationNumber();

    // Create leave application
    const application = await this.prisma.leaveApplication.create({
      data: {
        applicationNumber,
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        halfDayType: data.halfDayType as any,
        reason: data.reason,
        emergencyContact: data.emergencyContact,
        documentUrl: data.documentUrl,
        status: leaveType.requiresApproval ? 'PENDING_L1' : 'APPROVED',
      },
      include: {
        leaveType: true,
      },
    });

    // Update balance - mark as pending
    await this.balanceService.updatePending(
      data.employeeId,
      data.leaveTypeId,
      year,
      totalDays,
    );

    return application;
  }

  /**
   * Get leave application by ID
   */
  async getApplication(id: string) {
    const application = await this.prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        leaveType: true,
        approvalHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Leave application not found');
    }

    return application;
  }

  /**
   * Get employee leave applications
   */
  async getEmployeeApplications(employeeId: string, year?: number) {
    const whereClause: any = { employeeId };

    if (year) {
      whereClause.startDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }

    return this.prisma.leaveApplication.findMany({
      where: whereClause,
      include: {
        leaveType: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Cancel leave application
   */
  async cancelApplication(id: string, employeeId: string, reason: string) {
    const application = await this.prisma.leaveApplication.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Leave application not found');
    }

    if (application.employeeId !== employeeId) {
      throw new BadRequestException('Unauthorized to cancel this application');
    }

    if (!['PENDING', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3'].includes(application.status)) {
      throw new BadRequestException('Cannot cancel approved or rejected leave');
    }

    // Update application
    const cancelled = await this.prisma.leaveApplication.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    // Release pending balance
    const year = application.startDate.getFullYear();
    await this.balanceService.updatePending(
      application.employeeId,
      application.leaveTypeId,
      year,
      -application.totalDays.toNumber(),
    );

    return cancelled;
  }

  /**
   * Get all leave types
   */
  async getLeaveTypes() {
    return this.prisma.leaveType.findMany({
      where: { isActive: true },
      include: {
        policies: {
          where: { isActive: true },
        },
      },
    });
  }

  /**
   * Create leave type
   */
  async createLeaveType(data: {
    code: string;
    name: string;
    description?: string;
    isPaid: boolean;
    requiresApproval: boolean;
    maxDaysPerYear?: number;
    color?: string;
  }) {
    return this.prisma.leaveType.create({
      data,
    });
  }

  /**
   * Get leave statistics for employee
   */
  async getLeaveStatistics(employeeId: string, year: number) {
    const applications = await this.prisma.leaveApplication.findMany({
      where: {
        employeeId,
        startDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
      include: {
        leaveType: true,
      },
    });

    const balances = await this.balanceService.getAllBalances(employeeId, year);

    return {
      totalApplications: applications.length,
      approved: applications.filter((a) => a.status === 'APPROVED').length,
      pending: applications.filter((a) =>
        a.status.startsWith('PENDING'),
      ).length,
      rejected: applications.filter((a) => a.status === 'REJECTED').length,
      totalDaysTaken: applications
        .filter((a) => a.status === 'APPROVED')
        .reduce((sum, a) => sum + a.totalDays.toNumber(), 0),
      balances,
      applications,
    };
  }
}
