import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class InterviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Schedule interview
   */
  async schedule(data: {
    applicationId: string;
    requisitionId: string;
    round: number;
    interviewType: string;
    scheduledDate: Date;
    duration: number;
    mode: string;
    location?: string;
    meetingLink?: string;
    interviewerIds: string[];
  }) {
    const interview = await this.prisma.interview.create({
      data: {
        ...data,
        status: 'SCHEDULED',
      },
    });

    // Update application status
    await this.prisma.application.update({
      where: { id: data.applicationId },
      data: {
        status: 'INTERVIEW_SCHEDULED',
        currentStage: `Round ${data.round} - ${data.interviewType}`,
      },
    });

    this.eventEmitter.emit('interview.scheduled', {
      interviewId: interview.id,
      applicationId: data.applicationId,
      interviewerIds: data.interviewerIds,
    });

    return interview;
  }

  /**
   * Get all interviews
   */
  async findAll(filters?: {
    applicationId?: string;
    status?: string;
    interviewerId?: string;
  }) {
    const where: any = {};

    if (filters?.applicationId) {
      where.applicationId = filters.applicationId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.interviewerId) {
      where.interviewerIds = {
        has: filters.interviewerId,
      };
    }

    return this.prisma.interview.findMany({
      where,
      include: {
        application: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            applicationNumber: true,
          },
        },
        requisition: {
          select: {
            jobTitle: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    });
  }

  /**
   * Get interview by ID
   */
  async findOne(id: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: {
        application: true,
        requisition: true,
      },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    return interview;
  }

  /**
   * Submit feedback
   */
  async submitFeedback(
    id: string,
    feedback: {
      feedback: string;
      recommendation: string;
      technicalScore?: number;
      communicationScore?: number;
      cultureFitScore?: number;
      overallScore?: number;
    },
  ) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
    });

    if (!interview) {
      throw new NotFoundException('Interview not found');
    }

    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        conductedAt: new Date(),
        ...feedback,
      },
    });

    // Update application status
    await this.prisma.application.update({
      where: { id: interview.applicationId },
      data: {
        status: 'INTERVIEWED',
      },
    });

    this.eventEmitter.emit('interview.completed', {
      interviewId: id,
      applicationId: interview.applicationId,
      recommendation: feedback.recommendation,
    });

    return updated;
  }

  /**
   * Reschedule interview
   */
  async reschedule(id: string, newDate: Date, reason?: string) {
    const updated = await this.prisma.interview.update({
      where: { id },
      data: {
        scheduledDate: newDate,
        status: 'RESCHEDULED',
      },
    });

    this.eventEmitter.emit('interview.rescheduled', {
      interviewId: id,
      newDate,
      reason,
    });

    return updated;
  }

  /**
   * Cancel interview
   */
  async cancel(id: string, reason: string) {
    return this.prisma.interview.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        feedback: reason,
      },
    });
  }
}
