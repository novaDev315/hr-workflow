import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ShiftService } from './shift.service';

@Resolver('Shift')
export class ShiftResolver {
  constructor(private shiftService: ShiftService) {}

  // ==================== SHIFT DEFINITIONS ====================

  @Mutation('createShiftDefinition')
  async createShiftDefinition(
    @Args('input') input: {
      name: string;
      code: string;
      startTime: string;
      endTime: string;
      breakDuration?: number;
      workingHours?: number;
      isNightShift?: boolean;
      nightDifferential?: number;
      color?: string;
    },
  ) {
    return this.shiftService.createShiftDefinition(input);
  }

  @Query('shiftDefinitions')
  async shiftDefinitions(@Args('includeInactive') includeInactive?: boolean) {
    return this.shiftService.getShiftDefinitions(includeInactive);
  }

  @Query('shiftDefinition')
  async shiftDefinition(@Args('id', { type: () => ID }) id: string) {
    return this.shiftService.getShiftDefinition(id);
  }

  @Mutation('updateShiftDefinition')
  async updateShiftDefinition(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: any,
  ) {
    return this.shiftService.updateShiftDefinition(id, input);
  }

  // ==================== SHIFT SCHEDULING ====================

  @Mutation('scheduleShift')
  async scheduleShift(
    @Args('input') input: {
      employeeId: string;
      shiftId: string;
      date: string;
      locationId?: string;
      notes?: string;
    },
    @Args('createdBy') createdBy: string,
  ) {
    return this.shiftService.scheduleShift({
      ...input,
      date: new Date(input.date),
      createdBy,
    });
  }

  @Mutation('bulkScheduleShifts')
  async bulkScheduleShifts(
    @Args('schedules') schedules: Array<{
      employeeId: string;
      shiftId: string;
      date: string;
      locationId?: string;
    }>,
    @Args('createdBy') createdBy: string,
  ) {
    const parsedSchedules = schedules.map((s) => ({
      ...s,
      date: new Date(s.date),
    }));
    return this.shiftService.bulkScheduleShifts(parsedSchedules, createdBy);
  }

  @Query('employeeSchedule')
  async employeeSchedule(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.shiftService.getEmployeeSchedule(
      employeeId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Query('locationSchedule')
  async locationSchedule(
    @Args('locationId', { type: () => ID }) locationId: string,
    @Args('date') date: string,
  ) {
    return this.shiftService.getLocationSchedule(locationId, new Date(date));
  }

  @Mutation('updateScheduleStatus')
  async updateScheduleStatus(
    @Args('scheduleId', { type: () => ID }) scheduleId: string,
    @Args('status') status: string,
  ) {
    return this.shiftService.updateScheduleStatus(scheduleId, status as any);
  }

  // ==================== SHIFT SWAP REQUESTS ====================

  @Mutation('createSwapRequest')
  async createSwapRequest(
    @Args('input') input: {
      requesterId: string;
      requesterScheduleId: string;
      targetEmployeeId: string;
      targetScheduleId: string;
      reason: string;
    },
  ) {
    return this.shiftService.createSwapRequest(input);
  }

  @Mutation('respondToSwapRequest')
  async respondToSwapRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @Args('targetEmployeeId', { type: () => ID }) targetEmployeeId: string,
    @Args('accept') accept: boolean,
    @Args('response') response?: string,
  ) {
    return this.shiftService.respondToSwapRequest(requestId, targetEmployeeId, accept, response);
  }

  @Mutation('approveSwapRequest')
  async approveSwapRequest(
    @Args('requestId', { type: () => ID }) requestId: string,
    @Args('approverId', { type: () => ID }) approverId: string,
    @Args('approve') approve: boolean,
    @Args('response') response?: string,
  ) {
    return this.shiftService.approveSwapRequest(requestId, approverId, approve, response);
  }

  @Query('swapRequests')
  async swapRequests(
    @Args('employeeId') employeeId?: string,
    @Args('status') status?: string,
    @Args('asTarget') asTarget?: boolean,
  ) {
    return this.shiftService.getSwapRequests({
      employeeId,
      status: status as any,
      asTarget,
    });
  }

  // ==================== ROTATION PATTERNS ====================

  @Mutation('createRotationPattern')
  async createRotationPattern(
    @Args('input') input: {
      name: string;
      code: string;
      description?: string;
      cycleDays: number;
      shifts: Array<{
        dayOfCycle: number;
        shiftId: string;
        isOffDay?: boolean;
      }>;
    },
  ) {
    return this.shiftService.createRotationPattern(input);
  }

  @Query('rotationPatterns')
  async rotationPatterns() {
    return this.shiftService.getRotationPatterns();
  }

  @Mutation('assignRotationToEmployee')
  async assignRotationToEmployee(
    @Args('input') input: {
      employeeId: string;
      patternId: string;
      startDate: string;
      endDate?: string;
      cycleStartDay?: number;
    },
  ) {
    return this.shiftService.assignRotationToEmployee({
      ...input,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    });
  }

  @Mutation('generateSchedulesFromRotation')
  async generateSchedulesFromRotation(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('createdBy') createdBy: string,
  ) {
    return this.shiftService.generateSchedulesFromRotation(
      employeeId,
      new Date(startDate),
      new Date(endDate),
      createdBy,
    );
  }

  // ==================== SHIFT OVERRIDES ====================

  @Mutation('createShiftOverride')
  async createShiftOverride(
    @Args('input') input: {
      employeeId: string;
      date: string;
      originalShiftId?: string;
      newShiftId?: string;
      reason: string;
    },
  ) {
    return this.shiftService.createShiftOverride({
      ...input,
      date: new Date(input.date),
    });
  }

  @Mutation('approveShiftOverride')
  async approveShiftOverride(
    @Args('overrideId', { type: () => ID }) overrideId: string,
    @Args('approverId', { type: () => ID }) approverId: string,
    @Args('approve') approve: boolean,
  ) {
    return this.shiftService.approveShiftOverride(overrideId, approverId, approve);
  }

  // ==================== ANALYTICS ====================

  @Query('shiftStatistics')
  async shiftStatistics(
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('locationId') locationId?: string,
  ) {
    return this.shiftService.getShiftStatistics(
      new Date(startDate),
      new Date(endDate),
      locationId,
    );
  }

  @Query('nightDifferential')
  async nightDifferential(
    @Args('employeeId', { type: () => ID }) employeeId: string,
    @Args('month') month: number,
    @Args('year') year: number,
  ) {
    return this.shiftService.calculateNightDifferential(employeeId, month, year);
  }
}
