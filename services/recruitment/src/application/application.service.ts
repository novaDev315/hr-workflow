import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate unique application number
   */
  private async generateApplicationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = 'APP';

    const lastApp = await this.prisma.application.findFirst({
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
    if (lastApp) {
      const lastSequence = parseInt(
        lastApp.applicationNumber.slice(-5),
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${sequence.toString().padStart(5, '0')}`;
  }

  /**
   * Submit application
   */
  async create(data: any) {
    const requisition = await this.prisma.jobRequisition.findUnique({
      where: { id: data.requisitionId },
    });

    if (!requisition) {
      throw new NotFoundException('Job requisition not found');
    }

    if (requisition.status !== 'ACTIVE') {
      throw new BadRequestException('Job requisition is not active');
    }

    const applicationNumber = await this.generateApplicationNumber();

    const application = await this.prisma.application.create({
      data: {
        applicationNumber,
        ...data,
        status: 'RECEIVED',
      },
      include: {
        requisition: true,
      },
    });

    this.eventEmitter.emit('application.submitted', {
      applicationId: application.id,
      requisitionId: data.requisitionId,
      candidateEmail: data.email,
    });

    return application;
  }

  /**
   * Get all applications
   */
  async findAll(filters?: {
    requisitionId?: string;
    status?: string;
    source?: string;
  }) {
    const where: any = {};

    if (filters?.requisitionId) {
      where.requisitionId = filters.requisitionId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.source) {
      where.source = filters.source;
    }

    return this.prisma.application.findMany({
      where,
      include: {
        requisition: {
          select: {
            jobTitle: true,
            departmentId: true,
          },
        },
        _count: {
          select: {
            interviews: true,
          },
        },
      },
      orderBy: {
        appliedAt: 'desc',
      },
    });
  }

  /**
   * Get application by ID
   */
  async findOne(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        requisition: true,
        interviews: {
          orderBy: {
            round: 'asc',
          },
        },
        evaluations: true,
        offers: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  /**
   * Screen application
   */
  async screen(
    id: string,
    screenedBy: string,
    decision: 'SHORTLISTED' | 'REJECTED',
    notes?: string,
    score?: number,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: decision,
        screenedBy,
        screenedAt: new Date(),
        screeningNotes: notes,
        screeningScore: score,
      },
    });

    this.eventEmitter.emit('application.screened', {
      applicationId: id,
      decision,
      screenedBy,
    });

    return updated;
  }

  /**
   * Update application status
   */
  async updateStatus(id: string, status: string, currentStage?: string) {
    return this.prisma.application.update({
      where: { id },
      data: {
        status: status as any,
        currentStage,
      },
    });
  }

  /**
   * Bulk screening
   */
  async bulkScreen(
    applicationIds: string[],
    screenedBy: string,
    decision: 'SHORTLISTED' | 'REJECTED',
    notes?: string,
  ) {
    const results = [];

    for (const id of applicationIds) {
      try {
        const result = await this.screen(id, screenedBy, decision, notes);
        results.push({ id, success: true, ...result });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get application statistics
   */
  async getStatistics(requisitionId?: string) {
    const where = requisitionId ? { requisitionId } : {};

    const total = await this.prisma.application.count({ where });
    const received = await this.prisma.application.count({
      where: { ...where, status: 'RECEIVED' },
    });
    const shortlisted = await this.prisma.application.count({
      where: { ...where, status: 'SHORTLISTED' },
    });
    const interviewing = await this.prisma.application.count({
      where: { ...where, status: 'INTERVIEWING' },
    });
    const selected = await this.prisma.application.count({
      where: { ...where, status: 'SELECTED' },
    });
    const rejected = await this.prisma.application.count({
      where: { ...where, status: 'REJECTED' },
    });

    return {
      total,
      received,
      shortlisted,
      interviewing,
      selected,
      rejected,
      conversionRate: total > 0 ? (selected / total) * 100 : 0,
    };
  }

  /**
   * Search applications
   */
  async search(query: string) {
    return this.prisma.application.findMany({
      where: {
        OR: [
          {
            firstName: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            applicationNumber: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        requisition: {
          select: {
            jobTitle: true,
          },
        },
      },
      take: 20,
    });
  }
}
