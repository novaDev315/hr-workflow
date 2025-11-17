import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { differenceInMinutes, format } from 'date-fns';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clock In
   */
  async clockIn(data: {
    employeeId: string;
    locationId: string;
    latitude: number;
    longitude: number;
    distance: number;
    photoUrl?: string;
    notes?: string;
  }) {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Check if already clocked in today
    const existing = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: new Date(today),
        },
      },
    });

    if (existing?.clockInTime) {
      throw new BadRequestException('Already clocked in today');
    }

    const clockInTime = new Date();

    if (existing) {
      // Update existing record
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          clockInTime,
          clockInLatitude: data.latitude,
          clockInLongitude: data.longitude,
          clockInDistance: data.distance,
          clockInPhotoUrl: data.photoUrl,
          clockInNotes: data.notes,
          status: 'PENDING_L1',
        },
      });
    }

    // Create new attendance record
    return this.prisma.attendance.create({
      data: {
        employeeId: data.employeeId,
        locationId: data.locationId,
        date: new Date(today),
        clockInTime,
        clockInLatitude: data.latitude,
        clockInLongitude: data.longitude,
        clockInDistance: data.distance,
        clockInPhotoUrl: data.photoUrl,
        clockInNotes: data.notes,
        status: 'PENDING',
      },
    });
  }

  /**
   * Clock Out
   */
  async clockOut(data: {
    employeeId: string;
    latitude: number;
    longitude: number;
    distance: number;
    photoUrl?: string;
    notes?: string;
  }) {
    const today = format(new Date(), 'yyyy-MM-dd');

    const attendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: new Date(today),
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException('No clock-in record found for today');
    }

    if (!attendance.clockInTime) {
      throw new BadRequestException('Must clock in before clocking out');
    }

    if (attendance.clockOutTime) {
      throw new BadRequestException('Already clocked out today');
    }

    const clockOutTime = new Date();
    const totalMinutes = differenceInMinutes(clockOutTime, attendance.clockInTime);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(2));

    // Calculate regular and overtime (assuming 8 hour day)
    const regularHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(totalHours - 8, 0);

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOutTime,
        clockOutLatitude: data.latitude,
        clockOutLongitude: data.longitude,
        clockOutDistance: data.distance,
        clockOutPhotoUrl: data.photoUrl,
        clockOutNotes: data.notes,
        totalHours,
        regularHours,
        overtimeHours,
        isOvertime: overtimeHours > 0,
        status: 'PENDING_L1',
      },
    });
  }

  /**
   * Get attendance records
   */
  async findAll(filter: {
    employeeId?: string;
    locationId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const where: any = {};

    if (filter.employeeId) where.employeeId = filter.employeeId;
    if (filter.locationId) where.locationId = filter.locationId;
    if (filter.status) where.status = filter.status;

    if (filter.startDate || filter.endDate) {
      where.date = {};
      if (filter.startDate) where.date.gte = new Date(filter.startDate);
      if (filter.endDate) where.date.lte = new Date(filter.endDate);
    }

    return this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const attendance = await this.prisma.attendance.findUnique({
      where: { id },
      include: {
        corrections: true,
        approvalHistory: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!attendance) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }

    return attendance;
  }
}
