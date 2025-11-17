import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, ApprovalStatus } from '@prisma/client';

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Level 1: Supervisor Review
   */
  async level1Review(
    attendanceId: string,
    reviewerId: string,
    action: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED',
    notes?: string,
  ) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      throw new BadRequestException('Attendance record not found');
    }

    if (attendance.status !== 'PENDING_L1' && attendance.status !== 'PENDING') {
      throw new BadRequestException('Record not pending L1 review');
    }

    const newStatus: AttendanceStatus =
      action === 'APPROVED' ? 'PENDING_L2' : 'REJECTED';

    // Update attendance
    await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        l1ReviewedBy: reviewerId,
        l1ReviewedAt: new Date(),
        l1Status: action as ApprovalStatus,
        l1Notes: notes,
        status: newStatus,
      },
    });

    // Create audit trail
    await this.prisma.attendanceApprovalHistory.create({
      data: {
        attendanceId,
        approvalLevel: 1,
        approverId: reviewerId,
        action,
        previousStatus: attendance.status,
        newStatus,
        notes,
      },
    });

    return { success: true, newStatus };
  }

  /**
   * Level 2: Operations Manager Approval
   */
  async level2Approval(
    attendanceId: string,
    approverId: string,
    action: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance || attendance.status !== 'PENDING_L2') {
      throw new BadRequestException('Record not pending L2 approval');
    }

    const newStatus: AttendanceStatus =
      action === 'APPROVED' ? 'PENDING_L3' : 'REJECTED';

    await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        l2ApprovedBy: approverId,
        l2ApprovedAt: new Date(),
        l2Status: action as ApprovalStatus,
        l2Notes: notes,
        status: newStatus,
      },
    });

    await this.prisma.attendanceApprovalHistory.create({
      data: {
        attendanceId,
        approvalLevel: 2,
        approverId,
        action,
        previousStatus: attendance.status,
        newStatus,
        notes,
      },
    });

    return { success: true, newStatus };
  }

  /**
   * Level 3: Manager Verification
   */
  async level3Verification(
    attendanceId: string,
    verifierId: string,
    action: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance || attendance.status !== 'PENDING_L3') {
      throw new BadRequestException('Record not pending L3 verification');
    }

    const newStatus: AttendanceStatus =
      action === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        l3VerifiedBy: verifierId,
        l3VerifiedAt: new Date(),
        l3Status: action as ApprovalStatus,
        l3Notes: notes,
        status: newStatus,
      },
    });

    await this.prisma.attendanceApprovalHistory.create({
      data: {
        attendanceId,
        approvalLevel: 3,
        approverId: verifierId,
        action,
        previousStatus: attendance.status,
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
    attendanceIds: string[],
    level: 1 | 2 | 3,
    approverId: string,
    notes?: string,
  ) {
    const results = [];

    for (const id of attendanceIds) {
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

    return this.prisma.attendance.findMany({
      where: {
        status: { in: statusMap[level] },
      },
      orderBy: { date: 'desc' },
    });
  }
}
