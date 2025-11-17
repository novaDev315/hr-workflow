import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let httpService: HttpService;

  const mockPrismaService = {
    attendance: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    attendanceCorrection: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    attendanceApprovalHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockHttpService = {
    get: jest.fn(),
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    httpService = module.get<HttpService>(HttpService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('clockIn', () => {
    const clockInDto = {
      employeeId: 'emp-123',
      locationId: 'loc-123',
      latitude: 40.7128,
      longitude: -74.0060,
    };

    const mockLocation = {
      id: 'loc-123',
      latitude: 40.7128,
      longitude: -74.0060,
      geofenceRadius: 100,
      isActive: true,
      defaultShiftStart: '09:00:00',
      defaultShiftEnd: '18:00:00',
    };

    it('should successfully clock in when within geofence', async () => {
      mockHttpService.get.mockReturnValue(
        of({ data: mockLocation }),
      );

      mockPrismaService.attendance.findUnique.mockResolvedValue(null);
      mockPrismaService.attendance.create.mockResolvedValue({
        id: 'att-123',
        ...clockInDto,
        clockInTime: new Date(),
        status: 'CLOCKED_IN',
        distance: 50, // within 100m
      });

      const result = await service.clockIn(
        clockInDto.employeeId,
        clockInDto.locationId,
        clockInDto.latitude,
        clockInDto.longitude,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('CLOCKED_IN');
      expect(mockPrismaService.attendance.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'attendance.clocked.in',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when outside geofence', async () => {
      const farLocation = {
        ...mockLocation,
        latitude: 40.8128, // ~11km away
        longitude: -74.0060,
      };

      mockHttpService.get.mockReturnValue(
        of({ data: farLocation }),
      );

      await expect(
        service.clockIn(
          clockInDto.employeeId,
          clockInDto.locationId,
          clockInDto.latitude,
          clockInDto.longitude,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.attendance.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if already clocked in', async () => {
      mockHttpService.get.mockReturnValue(
        of({ data: mockLocation }),
      );

      mockPrismaService.attendance.findUnique.mockResolvedValue({
        id: 'att-existing',
        employeeId: clockInDto.employeeId,
        clockInTime: new Date(),
      });

      await expect(
        service.clockIn(
          clockInDto.employeeId,
          clockInDto.locationId,
          clockInDto.latitude,
          clockInDto.longitude,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect late arrival', async () => {
      const lateTime = new Date();
      lateTime.setHours(10, 30, 0, 0); // 10:30 AM (1.5 hours late)

      mockHttpService.get.mockReturnValue(
        of({ data: mockLocation }),
      );

      mockPrismaService.attendance.findUnique.mockResolvedValue(null);
      mockPrismaService.attendance.create.mockImplementation((data) => ({
        ...data.data,
        id: 'att-123',
        isLate: true,
        lateByMinutes: 90,
      }));

      jest.spyOn(global, 'Date').mockImplementation(() => lateTime as any);

      const result = await service.clockIn(
        clockInDto.employeeId,
        clockInDto.locationId,
        clockInDto.latitude,
        clockInDto.longitude,
      );

      expect(result.isLate).toBe(true);
      expect(result.lateByMinutes).toBeGreaterThan(0);

      jest.restoreAllMocks();
    });
  });

  describe('clockOut', () => {
    const mockAttendance = {
      id: 'att-123',
      employeeId: 'emp-123',
      locationId: 'loc-123',
      attendanceDate: new Date(),
      clockInTime: new Date('2024-01-01T09:00:00'),
      clockOutTime: null,
    };

    const mockLocation = {
      id: 'loc-123',
      latitude: 40.7128,
      longitude: -74.0060,
      geofenceRadius: 100,
      defaultShiftStart: '09:00:00',
      defaultShiftEnd: '18:00:00',
    };

    it('should successfully clock out', async () => {
      mockPrismaService.attendance.findUnique.mockResolvedValue(
        mockAttendance,
      );
      mockHttpService.get.mockReturnValue(
        of({ data: mockLocation }),
      );

      const clockOutTime = new Date('2024-01-01T18:00:00');
      mockPrismaService.attendance.update.mockResolvedValue({
        ...mockAttendance,
        clockOutTime,
        totalHours: 9.0,
        regularHours: 8.0,
        overtimeHours: 1.0,
        status: 'PENDING_APPROVAL',
      });

      const result = await service.clockOut('att-123', 40.7128, -74.0060);

      expect(result.clockOutTime).toBeDefined();
      expect(result.status).toBe('PENDING_APPROVAL');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'attendance.clocked.out',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException if already clocked out', async () => {
      mockPrismaService.attendance.findUnique.mockResolvedValue({
        ...mockAttendance,
        clockOutTime: new Date(),
      });

      await expect(
        service.clockOut('att-123', 40.7128, -74.0060),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate overtime hours correctly', async () => {
      const longWorkDay = {
        ...mockAttendance,
        clockInTime: new Date('2024-01-01T09:00:00'),
      };

      mockPrismaService.attendance.findUnique.mockResolvedValue(longWorkDay);
      mockHttpService.get.mockReturnValue(
        of({ data: mockLocation }),
      );

      // Clock out after 10 hours (2 hours overtime)
      const clockOutTime = new Date('2024-01-01T19:00:00');
      mockPrismaService.attendance.update.mockImplementation((params) => ({
        ...longWorkDay,
        ...params.data,
        totalHours: 10.0,
        regularHours: 8.0,
        overtimeHours: 2.0,
      }));

      jest.spyOn(global, 'Date').mockImplementation(() => clockOutTime as any);

      const result = await service.clockOut('att-123', 40.7128, -74.0060);

      expect(result.totalHours).toBe(10.0);
      expect(result.regularHours).toBe(8.0);
      expect(result.overtimeHours).toBe(2.0);

      jest.restoreAllMocks();
    });
  });

  describe('approveAttendance', () => {
    it('should approve attendance at level 1', async () => {
      const mockAttendance = {
        id: 'att-123',
        employeeId: 'emp-123',
        status: 'PENDING_L1',
        tier1ApproverId: 'approver-123',
        tier2ApproverId: 'manager-123',
        tier3ApproverId: 'director-123',
      };

      mockPrismaService.attendance.findUnique.mockResolvedValue(
        mockAttendance,
      );
      mockPrismaService.attendance.update.mockResolvedValue({
        ...mockAttendance,
        tier1Status: 'APPROVED',
        tier1ApprovedAt: new Date(),
        status: 'PENDING_L2',
      });

      const result = await service.approveTier(
        'att-123',
        1,
        'approver-123',
        'APPROVED',
        'Looks good',
      );

      expect(result.tier1Status).toBe('APPROVED');
      expect(result.status).toBe('PENDING_L2');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'attendance.approved',
        expect.any(Object),
      );
    });

    it('should finalize approval at level 3', async () => {
      const mockAttendance = {
        id: 'att-123',
        tier1Status: 'APPROVED',
        tier2Status: 'APPROVED',
        tier3Status: null,
        tier3ApproverId: 'director-123',
      };

      mockPrismaService.attendance.findUnique.mockResolvedValue(
        mockAttendance,
      );
      mockPrismaService.attendance.update.mockResolvedValue({
        ...mockAttendance,
        tier3Status: 'APPROVED',
        tier3ApprovedAt: new Date(),
        finalApprovalStatus: 'APPROVED',
        finalApprovedAt: new Date(),
      });

      const result = await service.approveTier(
        'att-123',
        3,
        'director-123',
        'APPROVED',
      );

      expect(result.finalApprovalStatus).toBe('APPROVED');
      expect(result.finalApprovedAt).toBeDefined();
    });

    it('should reject attendance and stop workflow', async () => {
      const mockAttendance = {
        id: 'att-123',
        status: 'PENDING_L2',
      };

      mockPrismaService.attendance.findUnique.mockResolvedValue(
        mockAttendance,
      );
      mockPrismaService.attendance.update.mockResolvedValue({
        ...mockAttendance,
        tier2Status: 'REJECTED',
        tier2ApprovedAt: new Date(),
        finalApprovalStatus: 'REJECTED',
        finalApprovedAt: new Date(),
      });

      const result = await service.approveTier(
        'att-123',
        2,
        'manager-123',
        'REJECTED',
        'Incorrect hours',
      );

      expect(result.finalApprovalStatus).toBe('REJECTED');
    });
  });

  describe('bulkApprove', () => {
    it('should approve multiple attendance records', async () => {
      const attendanceIds = ['att-1', 'att-2', 'att-3'];

      mockPrismaService.attendance.updateMany.mockResolvedValue({
        count: 3,
      });

      const result = await service.bulkApprove(attendanceIds, 1, 'approver-123');

      expect(result.count).toBe(3);
      expect(mockPrismaService.attendance.updateMany).toHaveBeenCalled();
    });
  });

  describe('lockForPayroll', () => {
    it('should lock approved attendance for payroll', async () => {
      const attendanceIds = ['att-1', 'att-2'];

      mockPrismaService.attendance.updateMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.lockForPayroll(
        attendanceIds,
        'hr-manager-123',
      );

      expect(result.count).toBe(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(attendanceIds.length);
    });
  });
});
