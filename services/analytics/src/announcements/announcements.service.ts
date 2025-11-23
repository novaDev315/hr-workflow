import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum AnnouncementPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum AnnouncementStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  targetAudience: 'ALL' | 'DEPARTMENT' | 'DESIGNATION' | 'SPECIFIC';
  targetDepartments?: string[];
  targetDesignations?: string[];
  targetEmployeeIds?: string[];
  attachmentUrl?: string;
  publishedAt?: Date;
  scheduledFor?: Date;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  readCount: number;
  acknowledgmentRequired: boolean;
}

@Injectable()
export class AnnouncementsService {
  // In-memory store for announcements (would typically be in DB)
  private announcements: Map<string, Announcement> = new Map();
  private readReceipts: Map<string, Set<string>> = new Map(); // announcementId -> Set<employeeId>
  private acknowledgments: Map<string, Set<string>> = new Map();

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {
    // Initialize with sample announcements
    this.initializeSampleAnnouncements();
  }

  private initializeSampleAnnouncements() {
    const sample: Announcement = {
      id: 'ann-001',
      title: 'Welcome to HRFlow Pro 2.0',
      content: 'We are excited to announce the launch of HRFlow Pro 2.0 with new features including shift management, onboarding workflows, and employee self-service portal.',
      summary: 'HRFlow Pro 2.0 is now live with exciting new features!',
      priority: AnnouncementPriority.HIGH,
      status: AnnouncementStatus.PUBLISHED,
      targetAudience: 'ALL',
      publishedAt: new Date(),
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      readCount: 0,
      acknowledgmentRequired: false,
    };
    this.announcements.set(sample.id, sample);
  }

  // ==================== CREATE ====================

  async createAnnouncement(data: {
    title: string;
    content: string;
    summary?: string;
    priority?: AnnouncementPriority;
    targetAudience: string;
    targetDepartments?: string[];
    targetDesignations?: string[];
    targetEmployeeIds?: string[];
    attachmentUrl?: string;
    scheduledFor?: Date;
    expiresAt?: Date;
    createdBy: string;
    acknowledgmentRequired?: boolean;
  }): Promise<Announcement> {
    const id = `ann-${Date.now()}`;

    const announcement: Announcement = {
      id,
      title: data.title,
      content: data.content,
      summary: data.summary,
      priority: data.priority || AnnouncementPriority.NORMAL,
      status: data.scheduledFor ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.DRAFT,
      targetAudience: data.targetAudience as any,
      targetDepartments: data.targetDepartments,
      targetDesignations: data.targetDesignations,
      targetEmployeeIds: data.targetEmployeeIds,
      attachmentUrl: data.attachmentUrl,
      scheduledFor: data.scheduledFor,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      readCount: 0,
      acknowledgmentRequired: data.acknowledgmentRequired || false,
    };

    this.announcements.set(id, announcement);
    this.eventEmitter.emit('announcement.created', announcement);

    return announcement;
  }

  // ==================== PUBLISH ====================

  async publishAnnouncement(id: string): Promise<Announcement> {
    const announcement = this.announcements.get(id);
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    announcement.status = AnnouncementStatus.PUBLISHED;
    announcement.publishedAt = new Date();
    announcement.updatedAt = new Date();

    this.announcements.set(id, announcement);

    // Emit event for notifications
    this.eventEmitter.emit('announcement.published', announcement);

    return announcement;
  }

  // ==================== GET ====================

  async getAnnouncements(filters?: {
    status?: AnnouncementStatus;
    priority?: AnnouncementPriority;
    employeeId?: string;
    departmentId?: string;
    limit?: number;
  }): Promise<Announcement[]> {
    let results = Array.from(this.announcements.values());

    // Filter by status
    if (filters?.status) {
      results = results.filter(a => a.status === filters.status);
    } else {
      // Default: only published and not expired
      results = results.filter(a =>
        a.status === AnnouncementStatus.PUBLISHED &&
        (!a.expiresAt || new Date(a.expiresAt) > new Date())
      );
    }

    // Filter by priority
    if (filters?.priority) {
      results = results.filter(a => a.priority === filters.priority);
    }

    // Filter by target audience (for employee view)
    if (filters?.employeeId && filters?.departmentId) {
      results = results.filter(a => {
        if (a.targetAudience === 'ALL') return true;
        if (a.targetAudience === 'DEPARTMENT' && a.targetDepartments?.includes(filters.departmentId!)) return true;
        if (a.targetAudience === 'SPECIFIC' && a.targetEmployeeIds?.includes(filters.employeeId!)) return true;
        return false;
      });
    }

    // Sort by priority and date
    results.sort((a, b) => {
      const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime();
    });

    // Apply limit
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async getAnnouncement(id: string): Promise<Announcement> {
    const announcement = this.announcements.get(id);
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  // ==================== READ TRACKING ====================

  async markAsRead(announcementId: string, employeeId: string): Promise<void> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    if (!this.readReceipts.has(announcementId)) {
      this.readReceipts.set(announcementId, new Set());
    }

    const readers = this.readReceipts.get(announcementId)!;
    if (!readers.has(employeeId)) {
      readers.add(employeeId);
      announcement.readCount++;
      this.announcements.set(announcementId, announcement);
    }
  }

  async isRead(announcementId: string, employeeId: string): Promise<boolean> {
    const readers = this.readReceipts.get(announcementId);
    return readers?.has(employeeId) || false;
  }

  // ==================== ACKNOWLEDGMENT ====================

  async acknowledgeAnnouncement(announcementId: string, employeeId: string): Promise<void> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    if (!announcement.acknowledgmentRequired) {
      throw new BadRequestException('This announcement does not require acknowledgment');
    }

    if (!this.acknowledgments.has(announcementId)) {
      this.acknowledgments.set(announcementId, new Set());
    }

    this.acknowledgments.get(announcementId)!.add(employeeId);

    this.eventEmitter.emit('announcement.acknowledged', {
      announcementId,
      employeeId,
      acknowledgedAt: new Date(),
    });
  }

  async getAcknowledgmentStatus(announcementId: string): Promise<{
    total: number;
    acknowledged: number;
    pending: number;
  }> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    const acknowledged = this.acknowledgments.get(announcementId)?.size || 0;

    // Get total target employees count
    let total = 0;
    if (announcement.targetAudience === 'ALL') {
      total = await this.prisma.employee.count({ where: { status: 'ACTIVE' } });
    } else if (announcement.targetAudience === 'DEPARTMENT' && announcement.targetDepartments) {
      total = await this.prisma.employee.count({
        where: { departmentId: { in: announcement.targetDepartments }, status: 'ACTIVE' },
      });
    } else if (announcement.targetAudience === 'SPECIFIC' && announcement.targetEmployeeIds) {
      total = announcement.targetEmployeeIds.length;
    }

    return {
      total,
      acknowledged,
      pending: total - acknowledged,
    };
  }

  // ==================== UPDATE/DELETE ====================

  async updateAnnouncement(id: string, data: Partial<Announcement>): Promise<Announcement> {
    const announcement = this.announcements.get(id);
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    const updated = {
      ...announcement,
      ...data,
      updatedAt: new Date(),
    };

    this.announcements.set(id, updated);
    return updated;
  }

  async archiveAnnouncement(id: string): Promise<Announcement> {
    return this.updateAnnouncement(id, { status: AnnouncementStatus.ARCHIVED });
  }

  async deleteAnnouncement(id: string): Promise<void> {
    if (!this.announcements.has(id)) {
      throw new NotFoundException('Announcement not found');
    }
    this.announcements.delete(id);
    this.readReceipts.delete(id);
    this.acknowledgments.delete(id);
  }

  // ==================== STATISTICS ====================

  async getAnnouncementStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    scheduled: number;
    totalReads: number;
    highPriorityActive: number;
  }> {
    const all = Array.from(this.announcements.values());

    return {
      total: all.length,
      published: all.filter(a => a.status === AnnouncementStatus.PUBLISHED).length,
      draft: all.filter(a => a.status === AnnouncementStatus.DRAFT).length,
      scheduled: all.filter(a => a.status === AnnouncementStatus.SCHEDULED).length,
      totalReads: all.reduce((sum, a) => sum + a.readCount, 0),
      highPriorityActive: all.filter(a =>
        a.status === AnnouncementStatus.PUBLISHED &&
        (a.priority === AnnouncementPriority.HIGH || a.priority === AnnouncementPriority.URGENT)
      ).length,
    };
  }
}
