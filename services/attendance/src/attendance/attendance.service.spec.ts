import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: PrismaService;

  const mockPrismaService = {
    attendance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('clockIn', () => {
    it('should successfully clock in an employee', async () => {
      const clockInData = {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        latitude: 40.7128,
        longitude: -74.0060,
        distance: 45,
      };

      mockPrismaService.attendance.findUnique.mockResolvedValue(null);
      mockPrismaService.attendance.create.mockResolvedValue({
        id: 'att-1',
        ...clockInData,
        clockInTime: new Date(),
        status: 'PENDING',
      });

      const result = await service.clockIn(clockInData);

      expect(result.clockInTime).toBeDefined();
      expect(result.status).toBe('PENDING');
    });

    it('should throw error if already clocked in', async () => {
      const clockInData = {
        employeeId: 'emp-1',
        locationId: 'loc-1',
        latitude: 40.7128,
        longitude: -74.0060,
        distance: 45,
      };

      mockPrismaService.attendance.findUnique.mockResolvedValue({
        id: 'att-1',
        clockInTime: new Date(),
      });

      await expect(service.clockIn(clockInData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('clockOut', () => {
    it('should calculate overtime correctly', async () => {
      const clockInTime = new Date('2024-11-16T09:00:00');
      const clockOutTime = new Date('2024-11-16T19:00:00'); // 10 hours

      mockPrismaService.attendance.findUnique.mockResolvedValue({
        id: 'att-1',
        clockInTime,
      });

      mockPrismaService.attendance.update.mockResolvedValue({
        id: 'att-1',
        clockInTime,
        clockOutTime,
        totalHours: 10,
        regularHours: 8,
        overtimeHours: 2,
      });

      const result = await service.clockOut({
        employeeId: 'emp-1',
        latitude: 40.7128,
        longitude: -74.0060,
        distance: 45,
      });

      expect(result.totalHours).toBe(10);
      expect(result.overtimeHours).toBe(2);
    });
  });
});
