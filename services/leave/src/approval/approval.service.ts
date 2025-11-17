import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from '../balance/balance.service';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
  ) {}

  /**
   * Level 1: Supervisor Review
   */
  async level1Review(
    applicationId: string,
    reviewerId: string,
    action: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED',
    notes?: string,
  ) {
    const application = await this.prisma.leaveApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new BadRequestException('Leave application not found');
    }

    if (application.status !== 'PENDING_L1' && application.status !== 'PENDING') {
      throw new BadRequestException('Application not pending L1 review');
    }

    let newStatus: string;
    if (action === 'APPROVED') {
      newStatus = 'PENDING_L2';
    } else if (action === 'REJECTED') {
      newStatus = 'REJECTED';
      // Release pending balance
      const year = application.startDate.getFullYear();
      await this.balanceService.rejectLeave(
        application.employeeId,
        application.leaveTypeId,
        year,
        application.totalDays.toNumber(),
      );
    } else {
      newStatus = 'PENDING_L1'; // Keep in L1 for revision
    }

    // Update application
    await this.prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        l1ReviewedBy: reviewerId,
        l1ReviewedAt: new Date(),
        l1Status: action as any,
        l1Notes: notes,
        status: newStatus as any,
        rejectedAt: action === 'REJECTED' ? new Date() : undefined,
      },
    });

    // Create audit trail
    await this.prisma.leaveApprovalHistory.create({
      data: {
        applicationId,
        approvalLevel: 1,
        approverId: reviewerId,
        action,
        previousStatus: application.status,
        newStatus,
        notes,
      },
    });

    return { success: true, newStatus };
  }

  /**
   * Level 2: Department Manager Approval
   */
  async level2Approval(
    applicationId: string,
    approverId: string,
    action: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) {
    const application = await this.prisma.leaveApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.status !== 'PENDING_L2') {
      throw new BadRequestException('Application not pending L2 approval');
    }

    let newStatus: string;
    if (action === 'APPROVED') {
      newStatus = 'PENDING_L3';
    } else {
      newStatus = 'REJECTED';
      // Release pending balance
      const year = application.startDate.getFullYear();
      await this.balanceService.rejectLeave(
        application.employeeId,
        application.leaveTypeId,
        year,
        application.totalDays.toNumber(),
      );
    }

    await this.prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        l2ApprovedBy: approverId,
        l2ApprovedAt: new Date(),
        l2Status: action as any,
        l2Notes: notes,
        status: newStatus as any,
        rejectedAt: action === 'REJECTED' ? new Date() : undefined,
      },
    });

    await this.prisma.leaveApprovalHistory.create({
      data: {
        applicationId,
        approvalLevel: 2,
        approverId,
        action,
        previousStatus: application.status,
        newStatus,
        notes,
      },
    });

    return { success: true, newStatus };
  }

  /**
   * Level 3: HR Verification
   */
  async level3Verification(
    applicationId: string,
    verifierId: string,
    action: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) {
    const application = await this.prisma.leaveApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.status !== 'PENDING_L3') {
      throw new BadRequestException('Application not pending L3 verification');
    }

    const year = application.startDate.getFullYear();
    const days = application.totalDays.toNumber();

    let newStatus: string;
    if (action === 'APPROVED') {
      newStatus = 'APPROVED';
      // Move from pending to used in balance
      await this.balanceService.approveLeave(
        application.employeeId,
        application.leaveTypeId,
        year,
        days,
      );
    } else {
      newStatus = 'REJECTED';
      // Release pending balance
      await this.balanceService.rejectLeave(
        application.employeeId,
        application.leaveTypeId,
        year,
        days,
      );
    }

    await this.prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        l3VerifiedBy: verifierId,
        l3VerifiedAt: new Date(),
        l3Status: action as any,
        l3Notes: notes,
        status: newStatus as any,
        approvedAt: action === 'APPROVED' ? new Date() : undefined,
        rejectedAt: action === 'REJECTED' ? new Date() : undefined,
      },
    });

    await this.prisma.leaveApprovalHistory.create({
      data: {
        applicationId,
        approvalLevel: 3,
        approverId: verifierId,
        action,
        previousStatus: application.status,
        newStatus,
        notes,
      },
    });

    return { success: true, newStatus };
  }

  /**
   * Bulk approval
   */
  async bulkApprove(
    applicationIds: string[],
    level: 1 | 2 | 3,
    approverId: string,
    notes?: string,
  ) {
    const results = [];

    for (const id of applicationIds) {
      try {
        let result;
        if (level === 1) {
          result = await this.level1Review(id, approverId, 'APPROVED', notes);
        } else if (level === 2) {
          result = await this.level2Approval(id, approverId, 'APPROVED', notes);
        } else {
          result = await this.level3Verification(id, approverId, 'APPROVED', notes);
        }
        results.push({ id, success: true, ...result });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string, level: 1 | 2 | 3) {
    const statusMap = {
      1: ['PENDING_L1', 'PENDING'],
      2: ['PENDING_L2'],
      3: ['PENDING_L3'],
    };

    return this.prisma.leaveApplication.findMany({
      where: {
        status: { in: statusMap[level] as any },
      },
      include: {
        leaveType: true,
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Get approval history for application
   */
  async getApprovalHistory(applicationId: string) {
    return this.prisma.leaveApprovalHistory.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
