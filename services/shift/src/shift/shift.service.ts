import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ScheduleStatus, SwapStatus, OverrideStatus } from '@prisma/client';

@Injectable()
export class ShiftService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ==================== SHIFT DEFINITIONS ====================

  async createShiftDefinition(data: {
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    breakDuration?: number;
    workingHours?: number;
    isNightShift?: boolean;
    nightDifferential?: number;
    color?: string;
  }) {
    const existing = await this.prisma.shiftDefinition.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new BadRequestException(`Shift with code ${data.code} already exists`);
    }

    const shift = await this.prisma.shiftDefinition.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        startTime: data.startTime,
        endTime: data.endTime,
        breakDuration: data.breakDuration || 60,
        workingHours: data.workingHours || 8,
        isNightShift: data.isNightShift || false,
        nightDifferential: data.nightDifferential || 0,
        color: data.color || '#3B82F6',
      },
    });

    this.eventEmitter.emit('shift.definition.created', shift);
    return shift;
  }

  async getShiftDefinitions(includeInactive = false) {
    return this.prisma.shiftDefinition.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { startTime: 'asc' },
    });
  }

  async getShiftDefinition(id: string) {
    const shift = await this.prisma.shiftDefinition.findUnique({
      where: { id },
    });

    if (!shift) {
      throw new NotFoundException('Shift definition not found');
    }

    return shift;
  }

  async updateShiftDefinition(id: string, data: Partial<{
    name: string;
    startTime: string;
    endTime: string;
    breakDuration: number;
    workingHours: number;
    isNightShift: boolean;
    nightDifferential: number;
    color: string;
    isActive: boolean;
  }>) {
    const shift = await this.prisma.shiftDefinition.update({
      where: { id },
      data,
    });

    this.eventEmitter.emit('shift.definition.updated', shift);
    return shift;
  }

  // ==================== SHIFT SCHEDULING ====================

  async scheduleShift(data: {
    employeeId: string;
    shiftId: string;
    date: Date;
    locationId?: string;
    notes?: string;
    createdBy: string;
  }) {
    // Check if shift definition exists
    const shiftDef = await this.prisma.shiftDefinition.findUnique({
      where: { id: data.shiftId },
    });

    if (!shiftDef) {
      throw new NotFoundException('Shift definition not found');
    }

    // Check for existing schedule on this date
    const existing = await this.prisma.shiftSchedule.findUnique({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: data.date,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Employee already has a shift scheduled for this date');
    }

    const schedule = await this.prisma.shiftSchedule.create({
      data: {
        employeeId: data.employeeId,
        shiftId: data.shiftId,
        date: data.date,
        locationId: data.locationId,
        notes: data.notes,
        createdBy: data.createdBy,
      },
      include: {
        shift: true,
      },
    });

    this.eventEmitter.emit('shift.scheduled', schedule);
    return schedule;
  }

  async bulkScheduleShifts(schedules: Array<{
    employeeId: string;
    shiftId: string;
    date: Date;
    locationId?: string;
  }>, createdBy: string) {
    const results = [];
    const errors = [];

    for (const schedule of schedules) {
      try {
        const created = await this.scheduleShift({
          ...schedule,
          createdBy,
        });
        results.push(created);
      } catch (error) {
        errors.push({
          employeeId: schedule.employeeId,
          date: schedule.date,
          error: error.message,
        });
      }
    }

    return { created: results, errors };
  }

  async getEmployeeSchedule(employeeId: string, startDate: Date, endDate: Date) {
    return this.prisma.shiftSchedule.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        shift: true,
      },
      orderBy: { date: 'asc' },
    });
  }

  async getLocationSchedule(locationId: string, date: Date) {
    return this.prisma.shiftSchedule.findMany({
      where: {
        locationId,
        date,
        status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.COMPLETED] },
      },
      include: {
        shift: true,
      },
      orderBy: { shift: { startTime: 'asc' } },
    });
  }

  async updateScheduleStatus(scheduleId: string, status: ScheduleStatus) {
    const schedule = await this.prisma.shiftSchedule.update({
      where: { id: scheduleId },
      data: { status },
      include: { shift: true },
    });

    this.eventEmitter.emit('shift.status.updated', schedule);
    return schedule;
  }

  // ==================== SHIFT SWAP REQUESTS ====================

  async createSwapRequest(data: {
    requesterId: string;
    requesterScheduleId: string;
    targetEmployeeId: string;
    targetScheduleId: string;
    reason: string;
  }) {
    // Validate requester's schedule
    const requesterSchedule = await this.prisma.shiftSchedule.findUnique({
      where: { id: data.requesterScheduleId },
    });

    if (!requesterSchedule || requesterSchedule.employeeId !== data.requesterId) {
      throw new BadRequestException('Invalid requester schedule');
    }

    // Validate target's schedule
    const targetSchedule = await this.prisma.shiftSchedule.findUnique({
      where: { id: data.targetScheduleId },
    });

    if (!targetSchedule || targetSchedule.employeeId !== data.targetEmployeeId) {
      throw new BadRequestException('Invalid target schedule');
    }

    // Generate request number
    const year = new Date().getFullYear();
    const lastRequest = await this.prisma.shiftSwapRequest.findFirst({
      where: {
        requestNumber: { startsWith: `SWAP${year}` },
      },
      orderBy: { requestNumber: 'desc' },
    });

    let sequence = 1;
    if (lastRequest) {
      const lastSequence = parseInt(lastRequest.requestNumber.slice(-5));
      sequence = lastSequence + 1;
    }
    const requestNumber = `SWAP${year}${sequence.toString().padStart(5, '0')}`;

    const swapRequest = await this.prisma.shiftSwapRequest.create({
      data: {
        requestNumber,
        requesterId: data.requesterId,
        requesterScheduleId: data.requesterScheduleId,
        targetEmployeeId: data.targetEmployeeId,
        targetScheduleId: data.targetScheduleId,
        reason: data.reason,
        status: SwapStatus.PENDING_TARGET,
      },
    });

    this.eventEmitter.emit('shift.swap.requested', swapRequest);
    return swapRequest;
  }

  async respondToSwapRequest(requestId: string, targetEmployeeId: string, accept: boolean, response?: string) {
    const request = await this.prisma.shiftSwapRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Swap request not found');
    }

    if (request.targetEmployeeId !== targetEmployeeId) {
      throw new BadRequestException('You are not the target of this swap request');
    }

    if (request.status !== SwapStatus.PENDING_TARGET) {
      throw new BadRequestException('This request has already been responded to');
    }

    const updatedRequest = await this.prisma.shiftSwapRequest.update({
      where: { id: requestId },
      data: {
        status: accept ? SwapStatus.PENDING_APPROVAL : SwapStatus.TARGET_REJECTED,
        targetResponse: response,
        targetRespondedAt: new Date(),
      },
    });

    this.eventEmitter.emit('shift.swap.responded', updatedRequest);
    return updatedRequest;
  }

  async approveSwapRequest(requestId: string, approverId: string, approve: boolean, response?: string) {
    const request = await this.prisma.shiftSwapRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Swap request not found');
    }

    if (request.status !== SwapStatus.PENDING_APPROVAL && request.status !== SwapStatus.TARGET_ACCEPTED) {
      throw new BadRequestException('This request is not pending approval');
    }

    if (approve) {
      // Execute the swap
      await this.prisma.$transaction(async (tx) => {
        // Get both schedules
        const requesterSchedule = await tx.shiftSchedule.findUnique({
          where: { id: request.requesterScheduleId },
        });
        const targetSchedule = await tx.shiftSchedule.findUnique({
          where: { id: request.targetScheduleId },
        });

        // Swap the shift assignments
        await tx.shiftSchedule.update({
          where: { id: request.requesterScheduleId },
          data: {
            shiftId: targetSchedule.shiftId,
            status: ScheduleStatus.SWAPPED,
          },
        });

        await tx.shiftSchedule.update({
          where: { id: request.targetScheduleId },
          data: {
            shiftId: requesterSchedule.shiftId,
            status: ScheduleStatus.SWAPPED,
          },
        });

        // Update request status
        await tx.shiftSwapRequest.update({
          where: { id: requestId },
          data: {
            status: SwapStatus.APPROVED,
            approverResponse: response,
            approvedBy: approverId,
            approvedAt: new Date(),
          },
        });
      });

      const updatedRequest = await this.prisma.shiftSwapRequest.findUnique({
        where: { id: requestId },
      });

      this.eventEmitter.emit('shift.swap.approved', updatedRequest);
      return updatedRequest;
    } else {
      const updatedRequest = await this.prisma.shiftSwapRequest.update({
        where: { id: requestId },
        data: {
          status: SwapStatus.REJECTED,
          approverResponse: response,
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      });

      this.eventEmitter.emit('shift.swap.rejected', updatedRequest);
      return updatedRequest;
    }
  }

  async getSwapRequests(filters: {
    employeeId?: string;
    status?: SwapStatus;
    asTarget?: boolean;
  }) {
    const where: any = {};

    if (filters.employeeId) {
      if (filters.asTarget) {
        where.targetEmployeeId = filters.employeeId;
      } else {
        where.requesterId = filters.employeeId;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.shiftSwapRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== ROTATION PATTERNS ====================

  async createRotationPattern(data: {
    name: string;
    code: string;
    description?: string;
    cycleDays: number;
    shifts: Array<{
      dayOfCycle: number;
      shiftId: string;
      isOffDay?: boolean;
    }>;
  }) {
    const pattern = await this.prisma.rotationPattern.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
        cycleDays: data.cycleDays,
        shifts: {
          create: data.shifts.map((s) => ({
            dayOfCycle: s.dayOfCycle,
            shiftId: s.shiftId,
            isOffDay: s.isOffDay || false,
          })),
        },
      },
      include: {
        shifts: {
          include: { shift: true },
          orderBy: { dayOfCycle: 'asc' },
        },
      },
    });

    this.eventEmitter.emit('rotation.pattern.created', pattern);
    return pattern;
  }

  async getRotationPatterns() {
    return this.prisma.rotationPattern.findMany({
      where: { isActive: true },
      include: {
        shifts: {
          include: { shift: true },
          orderBy: { dayOfCycle: 'asc' },
        },
      },
    });
  }

  async assignRotationToEmployee(data: {
    employeeId: string;
    patternId: string;
    startDate: Date;
    endDate?: Date;
    cycleStartDay?: number;
  }) {
    // Deactivate any existing rotation for this employee
    await this.prisma.rotationAssignment.updateMany({
      where: {
        employeeId: data.employeeId,
        isActive: true,
      },
      data: { isActive: false },
    });

    const assignment = await this.prisma.rotationAssignment.create({
      data: {
        employeeId: data.employeeId,
        patternId: data.patternId,
        startDate: data.startDate,
        endDate: data.endDate,
        cycleStartDay: data.cycleStartDay || 1,
      },
      include: {
        pattern: {
          include: {
            shifts: {
              include: { shift: true },
            },
          },
        },
      },
    });

    this.eventEmitter.emit('rotation.assigned', assignment);
    return assignment;
  }

  async generateSchedulesFromRotation(employeeId: string, startDate: Date, endDate: Date, createdBy: string) {
    // Get active rotation assignment
    const assignment = await this.prisma.rotationAssignment.findFirst({
      where: {
        employeeId,
        isActive: true,
        startDate: { lte: startDate },
        OR: [
          { endDate: null },
          { endDate: { gte: endDate } },
        ],
      },
      include: {
        pattern: {
          include: {
            shifts: {
              include: { shift: true },
              orderBy: { dayOfCycle: 'asc' },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('No active rotation assignment found for this employee');
    }

    const schedules = [];
    const pattern = assignment.pattern;
    const patternStartDate = new Date(assignment.startDate);

    // Calculate days since pattern start
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const daysSinceStart = Math.floor(
        (currentDate.getTime() - patternStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Adjust for cycle start day
      const adjustedDays = daysSinceStart + (assignment.cycleStartDay - 1);
      const dayOfCycle = (adjustedDays % pattern.cycleDays) + 1;

      const patternShift = pattern.shifts.find((s) => s.dayOfCycle === dayOfCycle);

      if (patternShift && !patternShift.isOffDay) {
        try {
          const schedule = await this.scheduleShift({
            employeeId,
            shiftId: patternShift.shiftId,
            date: new Date(currentDate),
            createdBy,
          });
          schedules.push(schedule);
        } catch (error) {
          // Skip if already scheduled
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedules;
  }

  // ==================== SHIFT OVERRIDES ====================

  async createShiftOverride(data: {
    employeeId: string;
    date: Date;
    originalShiftId?: string;
    newShiftId?: string;
    reason: string;
  }) {
    const override = await this.prisma.shiftOverride.create({
      data: {
        employeeId: data.employeeId,
        date: data.date,
        originalShiftId: data.originalShiftId,
        newShiftId: data.newShiftId,
        reason: data.reason,
      },
    });

    this.eventEmitter.emit('shift.override.created', override);
    return override;
  }

  async approveShiftOverride(overrideId: string, approverId: string, approve: boolean) {
    const override = await this.prisma.shiftOverride.update({
      where: { id: overrideId },
      data: {
        status: approve ? OverrideStatus.APPROVED : OverrideStatus.REJECTED,
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    if (approve && override.newShiftId) {
      // Update the schedule with the new shift
      await this.prisma.shiftSchedule.updateMany({
        where: {
          employeeId: override.employeeId,
          date: override.date,
        },
        data: {
          shiftId: override.newShiftId,
        },
      });
    }

    this.eventEmitter.emit('shift.override.processed', override);
    return override;
  }

  // ==================== ANALYTICS ====================

  async getShiftStatistics(startDate: Date, endDate: Date, locationId?: string) {
    const where: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (locationId) {
      where.locationId = locationId;
    }

    const schedules = await this.prisma.shiftSchedule.findMany({
      where,
      include: { shift: true },
    });

    const stats = {
      totalScheduled: schedules.length,
      byShift: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      nightShifts: 0,
      dayShifts: 0,
    };

    for (const schedule of schedules) {
      // By shift
      const shiftName = schedule.shift.name;
      stats.byShift[shiftName] = (stats.byShift[shiftName] || 0) + 1;

      // By status
      stats.byStatus[schedule.status] = (stats.byStatus[schedule.status] || 0) + 1;

      // Night vs day
      if (schedule.shift.isNightShift) {
        stats.nightShifts++;
      } else {
        stats.dayShifts++;
      }
    }

    return stats;
  }

  async calculateNightDifferential(employeeId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const nightSchedules = await this.prisma.shiftSchedule.findMany({
      where: {
        employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: ScheduleStatus.COMPLETED,
        shift: {
          isNightShift: true,
        },
      },
      include: { shift: true },
    });

    let totalNightHours = 0;
    let totalDifferentialPercentage = 0;

    for (const schedule of nightSchedules) {
      totalNightHours += schedule.shift.workingHours;
      totalDifferentialPercentage += schedule.shift.nightDifferential;
    }

    return {
      nightShiftsWorked: nightSchedules.length,
      totalNightHours,
      averageDifferentialPercentage: nightSchedules.length > 0
        ? totalDifferentialPercentage / nightSchedules.length
        : 0,
    };
  }
}
