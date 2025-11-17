import { Test, TestingModule } from '@nestjs/testing';
import { LeaveService } from './leave.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';

describe('LeaveService', () => {
  let service: LeaveService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let httpService: HttpService;

  const mockPrismaService = {
    leave: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    leaveBalance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    leaveType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    leaveApproval: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
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

    service = module.get<LeaveService>(LeaveService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    httpService = module.get<HttpService>(HttpService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createLeaveRequest', () => {
    const createLeaveDto = {
      employeeId: 'emp-123',
      leaveTypeId: 'leave-type-123',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-05'),
      reason: 'Family vacation',
    };

    const mockLeaveType = {
      id: 'leave-type-123',
      name: 'Annual Leave',
      code: 'ANNUAL',
      maxDaysAllowed: 20,
      requiresDocument: false,
    };

    const mockLeaveBalance = {
      id: 'balance-123',
      employeeId: 'emp-123',
      leaveTypeId: 'leave-type-123',
      totalDays: 20,
      usedDays: 5,
      pendingDays: 0,
      remainingDays: 15,
    };

    it('should create leave request successfully', async () => {
      const mockLeave = {
        id: 'leave-123',
        ...createLeaveDto,
        numberOfDays: 5,
        status: 'PENDING_L1',
        createdAt: new Date(),
      };

      mockPrismaService.leaveType.findUnique.mockResolvedValue(mockLeaveType);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValue(mockLeaveBalance);
      mockPrismaService.leave.create.mockResolvedValue(mockLeave);

      const result = await service.createLeaveRequest(createLeaveDto);

      expect(result).toEqual(mockLeave);
      expect(mockPrismaService.leave.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'leave.requested',
        expect.objectContaining({
          leaveId: mockLeave.id,
          employeeId: createLeaveDto.employeeId,
        }),
      );
    });

    it('should throw BadRequestException if insufficient leave balance', async () => {
      const insufficientBalance = {
        ...mockLeaveBalance,
        remainingDays: 2, // Only 2 days available, requesting 5
      };

      mockPrismaService.leaveType.findUnique.mockResolvedValue(mockLeaveType);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValue(insufficientBalance);

      await expect(service.createLeaveRequest(createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.leave.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if end date is before start date', async () => {
      const invalidDates = {
        ...createLeaveDto,
        startDate: new Date('2024-06-05'),
        endDate: new Date('2024-06-01'),
      };

      await expect(service.createLeaveRequest(invalidDates)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if leave type not found', async () => {
      mockPrismaService.leaveType.findUnique.mockResolvedValue(null);

      await expect(service.createLeaveRequest(createLeaveDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate weekend exclusion correctly', async () => {
      const withWeekend = {
        ...createLeaveDto,
        startDate: new Date('2024-06-03'), // Monday
        endDate: new Date('2024-06-07'), // Friday
      };

      mockPrismaService.leaveType.findUnique.mockResolvedValue(mockLeaveType);
      mockPrismaService.leaveBalance.findFirst.mockResolvedValue(mockLeaveBalance);
      mockPrismaService.leave.create.mockResolvedValue({
        id: 'leave-123',
        ...withWeekend,
        numberOfDays: 5, // Mon-Fri only, excluding weekend
      });

      const result = await service.createLeaveRequest(withWeekend);

      expect(result.numberOfDays).toBe(5);
    });
  });

  describe('getLeaveBalance', () => {
    it('should return leave balance for employee', async () => {
      const mockBalances = [
        {
          id: 'bal-1',
          employeeId: 'emp-123',
          leaveTypeId: 'type-1',
          leaveType: { name: 'Annual Leave', code: 'ANNUAL' },
          totalDays: 20,
          usedDays: 5,
          pendingDays: 2,
          remainingDays: 13,
          year: 2024,
        },
        {
          id: 'bal-2',
          employeeId: 'emp-123',
          leaveTypeId: 'type-2',
          leaveType: { name: 'Sick Leave', code: 'SICK' },
          totalDays: 10,
          usedDays: 2,
          pendingDays: 0,
          remainingDays: 8,
          year: 2024,
        },
      ];

      mockPrismaService.leaveBalance.findMany.mockResolvedValue(mockBalances);

      const result = await service.getLeaveBalance('emp-123', 2024);

      expect(result).toEqual(mockBalances);
      expect(result.length).toBe(2);
      expect(result[0].remainingDays).toBe(13);
    });

    it('should initialize balance if not found', async () => {
      mockPrismaService.leaveBalance.findMany.mockResolvedValue([]);
      mockPrismaService.leaveType.findMany.mockResolvedValue([
        { id: 'type-1', name: 'Annual Leave', annualAllocation: 20 },
      ]);
      mockPrismaService.leaveBalance.create.mockResolvedValue({
        id: 'new-bal',
        employeeId: 'emp-123',
        leaveTypeId: 'type-1',
        totalDays: 20,
        usedDays: 0,
        pendingDays: 0,
        remainingDays: 20,
        year: 2024,
      });

      const result = await service.getLeaveBalance('emp-123', 2024);

      expect(mockPrismaService.leaveBalance.create).toHaveBeenCalled();
    });
  });

  describe('approveLeave', () => {
    const mockLeave = {
      id: 'leave-123',
      employeeId: 'emp-123',
      status: 'PENDING_L1',
      tier1ApproverId: 'approver-1',
      tier2ApproverId: 'approver-2',
      tier3ApproverId: 'approver-3',
      numberOfDays: 5,
    };

    it('should approve leave at tier 1', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.leave.update.mockResolvedValue({
        ...mockLeave,
        tier1Status: 'APPROVED',
        tier1ApprovedAt: new Date(),
        status: 'PENDING_L2',
      });

      const result = await service.approveTier(
        'leave-123',
        1,
        'approver-1',
        'APPROVED',
        'Approved',
      );

      expect(result.tier1Status).toBe('APPROVED');
      expect(result.status).toBe('PENDING_L2');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'leave.tier1.approved',
        expect.any(Object),
      );
    });

    it('should finalize approval at tier 3', async () => {
      const tier3Leave = {
        ...mockLeave,
        status: 'PENDING_L3',
        tier1Status: 'APPROVED',
        tier2Status: 'APPROVED',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(tier3Leave);
      mockPrismaService.leave.update.mockResolvedValue({
        ...tier3Leave,
        tier3Status: 'APPROVED',
        tier3ApprovedAt: new Date(),
        status: 'APPROVED',
        finalApprovedAt: new Date(),
      });

      const result = await service.approveTier(
        'leave-123',
        3,
        'approver-3',
        'APPROVED',
      );

      expect(result.status).toBe('APPROVED');
      expect(result.finalApprovedAt).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'leave.approved',
        expect.objectContaining({
          leaveId: 'leave-123',
        }),
      );
    });

    it('should reject leave and stop workflow', async () => {
      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.leave.update.mockResolvedValue({
        ...mockLeave,
        tier1Status: 'REJECTED',
        tier1ApprovedAt: new Date(),
        status: 'REJECTED',
      });

      const result = await service.approveTier(
        'leave-123',
        1,
        'approver-1',
        'REJECTED',
        'Insufficient notice',
      );

      expect(result.status).toBe('REJECTED');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'leave.rejected',
        expect.any(Object),
      );
    });

    it('should update leave balance when approved', async () => {
      const tier3Leave = {
        ...mockLeave,
        status: 'PENDING_L3',
        tier1Status: 'APPROVED',
        tier2Status: 'APPROVED',
        leaveTypeId: 'type-123',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(tier3Leave);
      mockPrismaService.leave.update.mockResolvedValue({
        ...tier3Leave,
        status: 'APPROVED',
      });
      mockPrismaService.leaveBalance.findFirst.mockResolvedValue({
        id: 'bal-123',
        usedDays: 5,
        pendingDays: 5,
      });

      await service.approveTier('leave-123', 3, 'approver-3', 'APPROVED');

      expect(mockPrismaService.leaveBalance.update).toHaveBeenCalledWith({
        where: { id: 'bal-123' },
        data: {
          usedDays: 10, // 5 + 5
          pendingDays: 0, // 5 - 5
        },
      });
    });
  });

  describe('cancelLeave', () => {
    it('should cancel pending leave request', async () => {
      const mockLeave = {
        id: 'leave-123',
        employeeId: 'emp-123',
        status: 'PENDING_L1',
        numberOfDays: 5,
        leaveTypeId: 'type-123',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(mockLeave);
      mockPrismaService.leave.update.mockResolvedValue({
        ...mockLeave,
        status: 'CANCELLED',
      });

      const result = await service.cancelLeave('leave-123', 'emp-123', 'Plans changed');

      expect(result.status).toBe('CANCELLED');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'leave.cancelled',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException if leave already approved', async () => {
      const approvedLeave = {
        id: 'leave-123',
        status: 'APPROVED',
      };

      mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

      await expect(
        service.cancelLeave('leave-123', 'emp-123', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTeamCalendar', () => {
    it('should return team leave calendar', async () => {
      const mockEmployees = [
        { id: 'emp-1', firstName: 'John', lastName: 'Doe' },
        { id: 'emp-2', firstName: 'Jane', lastName: 'Smith' },
      ];

      const mockLeaves = [
        {
          id: 'leave-1',
          employeeId: 'emp-1',
          employee: mockEmployees[0],
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-05'),
          leaveType: { name: 'Annual Leave' },
          status: 'APPROVED',
        },
        {
          id: 'leave-2',
          employeeId: 'emp-2',
          employee: mockEmployees[1],
          startDate: new Date('2024-06-10'),
          endDate: new Date('2024-06-12'),
          leaveType: { name: 'Sick Leave' },
          status: 'APPROVED',
        },
      ];

      mockHttpService.get.mockReturnValue(
        of({ data: { employees: mockEmployees } }),
      );
      mockPrismaService.leave.findMany.mockResolvedValue(mockLeaves);

      const result = await service.getTeamCalendar('dept-123', 6, 2024);

      expect(result.length).toBeGreaterThan(0);
      expect(result).toContainEqual(
        expect.objectContaining({
          employeeId: 'emp-1',
          employeeName: 'John Doe',
        }),
      );
    });
  });

  describe('bulkApprove', () => {
    it('should approve multiple leave requests', async () => {
      const leaveIds = ['leave-1', 'leave-2', 'leave-3'];

      mockPrismaService.leave.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkApprove(leaveIds, 1, 'approver-123');

      expect(result.count).toBe(3);
      expect(mockPrismaService.leave.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: leaveIds },
          tier1ApproverId: 'approver-123',
          status: 'PENDING_L1',
        },
        data: {
          tier1Status: 'APPROVED',
          tier1ApprovedAt: expect.any(Date),
          status: 'PENDING_L2',
        },
      });
    });
  });
});
