import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OfferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate unique offer number
   */
  private async generateOfferNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = 'OFFER';

    const lastOffer = await this.prisma.jobOffer.findFirst({
      where: {
        offerNumber: {
          startsWith: `${prefix}${year}`,
        },
      },
      orderBy: {
        offerNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastOffer) {
      const lastSequence = parseInt(
        lastOffer.offerNumber.slice(-4),
        10,
      );
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Create job offer
   */
  async create(data: {
    applicationId: string;
    designation: string;
    departmentId: string;
    reportingTo?: string;
    ctc: number;
    basicSalary: number;
    variablePay: number;
    benefits: any;
    joiningDate: Date;
    offerValidTill: Date;
    createdBy: string;
  }) {
    const application = await this.prisma.application.findUnique({
      where: { id: data.applicationId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status !== 'SELECTED') {
      throw new BadRequestException('Candidate must be selected before offering');
    }

    const offerNumber = await this.generateOfferNumber();

    const offer = await this.prisma.jobOffer.create({
      data: {
        offerNumber,
        applicationId: data.applicationId,
        designation: data.designation,
        departmentId: data.departmentId,
        reportingTo: data.reportingTo,
        ctc: new Decimal(data.ctc),
        basicSalary: new Decimal(data.basicSalary),
        variablePay: new Decimal(data.variablePay),
        benefits: JSON.stringify(data.benefits),
        joiningDate: data.joiningDate,
        offerValidTill: data.offerValidTill,
        createdBy: data.createdBy,
        status: 'DRAFT',
      },
      include: {
        application: true,
      },
    });

    return offer;
  }

  /**
   * Send offer
   */
  async send(id: string, offerLetterUrl: string) {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const updated = await this.prisma.jobOffer.update({
      where: { id },
      data: {
        status: 'SENT',
        offerLetterUrl,
      },
    });

    // Update application status
    await this.prisma.application.update({
      where: { id: offer.applicationId },
      data: {
        status: 'OFFERED',
      },
    });

    this.eventEmitter.emit('offer.sent', {
      offerId: id,
      applicationId: offer.applicationId,
      candidateEmail: offer.application.email,
    });

    return updated;
  }

  /**
   * Accept offer
   */
  async accept(id: string) {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const updated = await this.prisma.jobOffer.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    // Update application status
    await this.prisma.application.update({
      where: { id: offer.applicationId },
      data: {
        status: 'OFFER_ACCEPTED',
      },
    });

    this.eventEmitter.emit('offer.accepted', {
      offerId: id,
      applicationId: offer.applicationId,
    });

    return updated;
  }

  /**
   * Decline offer
   */
  async decline(id: string, reason: string) {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const updated = await this.prisma.jobOffer.update({
      where: { id },
      data: {
        status: 'DECLINED',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Update application status
    await this.prisma.application.update({
      where: { id: offer.applicationId },
      data: {
        status: 'OFFER_DECLINED',
      },
    });

    return updated;
  }

  /**
   * Get all offers
   */
  async findAll(filters?: { status?: string }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.jobOffer.findMany({
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get offer by ID
   */
  async findOne(id: string) {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }
}
