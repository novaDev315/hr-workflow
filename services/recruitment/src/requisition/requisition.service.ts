import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { format } from 'date-fns';

@Injectable()
export class RequisitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate unique requisition number
   */
  private async generateRequisitionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = 'REQ';

    const lastReq = await this.prisma.jobRequisition.findFirst({
      where: {
        requisitionNumber: {
          startsWith: `${prefix}${year}`,
        },
      },
      orderBy: {
        requisitionNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastReq) {
      const lastSequence = parseInt(
        lastReq.requisitionNumber.slice(-4),
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create job requisition
   */
  async create(data: any) {
    const requisitionNumber = await this.generateRequisitionNumber();

    const requisition = await this.prisma.jobRequisition.create({
      data: {
        requisitionNumber,
        ...data,
        status: 'DRAFT',
      },
    });

    this.eventEmitter.emit('requisition.created', {
      requisitionId: requisition.id,
      requisitionNumber,
    });

    return requisition;
  }

  /**
   * Get all requisitions
   */
  async findAll(filters?: {
    status?: string;
    departmentId?: string;
    priority?: string;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }

    return this.prisma.jobRequisition.findMany({
      where,
      include: {
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get active job openings
   */
  async getActiveOpenings() {
    return this.prisma.jobRequisition.findMany({
      where: {
        status: 'ACTIVE',
        applicationDeadline: {
          gte: new Date(),
        },
      },
      select: {
        id: true,
        requisitionNumber: true,
        jobTitle: true,
        departmentId: true,
        employmentType: true,
        experienceLevel: true,
        location: true,
        isRemote: true,
        description: true,
        requirements: true,
        salaryRangeMin: true,
        salaryRangeMax: true,
        applicationDeadline: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get requisition by ID
   */
  async findOne(id: string) {
    const requisition = await this.prisma.jobRequisition.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            interviews: true,
          },
        },
      },
    });

    if (!requisition) {
      throw new NotFoundException('Job requisition not found');
    }

    return requisition;
  }

  /**
   * Update requisition
   */
  async update(id: string, data: any) {
    const requisition = await this.prisma.jobRequisition.findUnique({
      where: { id },
    });

    if (!requisition) {
      throw new NotFoundException('Job requisition not found');
    }

    return this.prisma.jobRequisition.update({
      where: { id },
      data,
    });
  }

  /**
   * Approve requisition
   */
  async approve(id: string, approvedBy: string) {
    const requisition = await this.prisma.jobRequisition.findUnique({
      where: { id },
    });

    if (!requisition) {
      throw new NotFoundException('Job requisition not found');
    }

    if (requisition.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Requisition is not pending approval');
    }

    const updated = await this.prisma.jobRequisition.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    this.eventEmitter.emit('requisition.approved', {
      requisitionId: id,
      approvedBy,
    });

    return updated;
  }

  /**
   * Activate requisition (post jobs)
   */
  async activate(id: string) {
    return this.prisma.jobRequisition.update({
      where: { id },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Close requisition
   */
  async close(id: string, reason: 'FILLED' | 'CANCELLED') {
    return this.prisma.jobRequisition.update({
      where: { id },
      data: {
        status: reason,
      },
    });
  }

  /**
   * Get requisition statistics
   */
  async getStatistics() {
    const total = await this.prisma.jobRequisition.count();
    const active = await this.prisma.jobRequisition.count({
      where: { status: 'ACTIVE' },
    });
    const filled = await this.prisma.jobRequisition.count({
      where: { status: 'FILLED' },
    });
    const cancelled = await this.prisma.jobRequisition.count({
      where: { status: 'CANCELLED' },
    });

    return {
      total,
      active,
      filled,
      cancelled,
      fillRate: total > 0 ? (filled / total) * 100 : 0,
    };
  }
}
