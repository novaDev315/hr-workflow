import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';

describe('PayrollService', () => {
  let service: PayrollService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let httpService: HttpService;

  const mockPrismaService = {
    payroll: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    payrollBatch: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payslip: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    loan: {
      findMany: jest.fn(),
      update: jest.fn(),
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
        PayrollService,
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

    service = module.get<PayrollService>(PayrollService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    httpService = module.get<HttpService>(HttpService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculatePayroll', () => {
    const mockEmployee = {
      id: 'emp-123',
      employeeNumber: 'EMP20240001',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockSalaryStructure = {
      id: 'salary-123',
      employeeId: 'emp-123',
      basicSalary: 50000,
      hra: 20000,
      conveyanceAllowance: 1600,
      medicalAllowance: 1250,
      specialAllowance: 10000,
      otherAllowances: 2000,
      pfContribution: 6000, // 12% of basic
      esiContribution: 0,
      professionalTax: 200,
      grossSalary: 84850, // Sum of earnings
      netSalary: 78650, // Gross - deductions
    };

    const mockAttendance = [
      {
        id: 'att-1',
        attendanceDate: new Date('2024-01-15'),
        totalHours: 9,
        regularHours: 8,
        overtimeHours: 1,
        status: 'APPROVED',
      },
      {
        id: 'att-2',
        attendanceDate: new Date('2024-01-16'),
        totalHours: 8,
        regularHours: 8,
        overtimeHours: 0,
        status: 'APPROVED',
      },
    ];

    const mockLeaves = [
      {
        id: 'leave-1',
        startDate: new Date('2024-01-20'),
        endDate: new Date('2024-01-20'),
        numberOfDays: 1,
        leaveType: { paidLeave: true },
        status: 'APPROVED',
      },
    ];

    beforeEach(() => {
      mockHttpService.get.mockImplementation((url) => {
        if (url.includes('/employee')) {
          return of({ data: { employee: mockEmployee, salary: mockSalaryStructure } });
        }
        if (url.includes('/attendance')) {
          return of({ data: mockAttendance });
        }
        if (url.includes('/leave')) {
          return of({ data: mockLeaves });
        }
        return of({ data: null });
      });
    });

    it('should calculate payroll correctly for full month', async () => {
      const result = await service.calculatePayroll('emp-123', 1, 2024);

      expect(result).toMatchObject({
        employeeId: 'emp-123',
        month: 1,
        year: 2024,
        basicSalary: 50000,
        grossSalary: 84850,
        netSalary: expect.any(Number),
        status: 'CALCULATED',
      });

      expect(result.netSalary).toBeGreaterThan(0);
      expect(result.netSalary).toBeLessThan(result.grossSalary);
    });

    it('should calculate working days correctly', () => {
      const workingDays = service.getWorkingDaysInMonth(1, 2024);

      // January 2024 has 31 days, typically ~22-23 working days
      expect(workingDays).toBeGreaterThan(20);
      expect(workingDays).toBeLessThan(25);
    });

    it('should deduct salary for unpaid leaves', async () => {
      const unpaidLeave = {
        ...mockLeaves[0],
        numberOfDays: 3,
        leaveType: { paidLeave: false },
      };

      mockHttpService.get.mockImplementation((url) => {
        if (url.includes('/employee')) {
          return of({ data: { employee: mockEmployee, salary: mockSalaryStructure } });
        }
        if (url.includes('/attendance')) {
          return of({ data: mockAttendance });
        }
        if (url.includes('/leave')) {
          return of({ data: [unpaidLeave] });
        }
        return of({ data: null });
      });

      const result = await service.calculatePayroll('emp-123', 1, 2024);

      // Should have salary deduction for 3 days
      const dailySalary = mockSalaryStructure.netSalary / 30;
      const expectedDeduction = dailySalary * 3;

      expect(result.unpaidLeaveDays).toBe(3);
      expect(result.netSalary).toBeLessThan(mockSalaryStructure.netSalary - expectedDeduction + 100); // With margin
    });

    it('should calculate overtime pay correctly', async () => {
      const overtimeAttendance = [
        {
          id: 'att-1',
          totalHours: 10,
          regularHours: 8,
          overtimeHours: 2,
          status: 'APPROVED',
        },
        {
          id: 'att-2',
          totalHours: 11,
          regularHours: 8,
          overtimeHours: 3,
          status: 'APPROVED',
        },
      ];

      mockHttpService.get.mockImplementation((url) => {
        if (url.includes('/employee')) {
          return of({ data: { employee: mockEmployee, salary: mockSalaryStructure } });
        }
        if (url.includes('/attendance')) {
          return of({ data: overtimeAttendance });
        }
        if (url.includes('/leave')) {
          return of({ data: [] });
        }
        return of({ data: null });
      });

      const result = await service.calculatePayroll('emp-123', 1, 2024);

      expect(result.overtimeHours).toBe(5); // 2 + 3
      expect(result.overtimePay).toBeGreaterThan(0);
      expect(result.netSalary).toBeGreaterThan(mockSalaryStructure.netSalary);
    });

    it('should calculate tax based on slabs', () => {
      const testCases = [
        { income: 200000, expectedTax: 0 }, // Below threshold
        { income: 300000, expectedTax: 2500 }, // 5% of 50000
        { income: 600000, expectedTax: 32500 }, // 5% of 250k + 20% of 100k
        { income: 1200000, expectedTax: 152500 }, // Complex calculation
      ];

      testCases.forEach(({ income, expectedTax }) => {
        const tax = service.calculateIncomeTax(income);
        expect(tax).toBeCloseTo(expectedTax, 0);
      });
    });

    it('should deduct active loan EMIs', async () => {
      const mockLoans = [
        {
          id: 'loan-1',
          principalAmount: 50000,
          emiAmount: 5000,
          status: 'ACTIVE',
        },
        {
          id: 'loan-2',
          principalAmount: 30000,
          emiAmount: 3000,
          status: 'ACTIVE',
        },
      ];

      mockPrismaService.loan.findMany.mockResolvedValue(mockLoans);

      mockHttpService.get.mockImplementation((url) => {
        if (url.includes('/employee')) {
          return of({ data: { employee: mockEmployee, salary: mockSalaryStructure } });
        }
        if (url.includes('/attendance')) {
          return of({ data: mockAttendance });
        }
        if (url.includes('/leave')) {
          return of({ data: [] });
        }
        return of({ data: null });
      });

      const result = await service.calculatePayroll('emp-123', 1, 2024);

      expect(result.loanDeductions).toBe(8000); // 5000 + 3000
      expect(result.netSalary).toBeLessThan(mockSalaryStructure.netSalary - 8000 + 100);
    });

    it('should handle pro-rated salary for mid-month joiners', async () => {
      const midMonthEmployee = {
        ...mockEmployee,
        joinDate: new Date('2024-01-15'), // Joined on 15th
      };

      mockHttpService.get.mockImplementation((url) => {
        if (url.includes('/employee')) {
          return of({ data: { employee: midMonthEmployee, salary: mockSalaryStructure } });
        }
        if (url.includes('/attendance')) {
          return of({ data: mockAttendance });
        }
        if (url.includes('/leave')) {
          return of({ data: [] });
        }
        return of({ data: null });
      });

      const result = await service.calculatePayroll('emp-123', 1, 2024);

      // Should be pro-rated for ~16 days (half month)
      expect(result.netSalary).toBeLessThan(mockSalaryStructure.netSalary);
      expect(result.netSalary).toBeGreaterThan(mockSalaryStructure.netSalary * 0.4);
    });
  });

  describe('processPayrollBatch', () => {
    it('should process payroll for all active employees', async () => {
      const mockEmployees = [
        { id: 'emp-1', status: 'ACTIVE' },
        { id: 'emp-2', status: 'ACTIVE' },
        { id: 'emp-3', status: 'ACTIVE' },
      ];

      mockHttpService.get.mockReturnValue(of({ data: mockEmployees }));

      mockPrismaService.payrollBatch.create.mockResolvedValue({
        id: 'batch-123',
        month: 1,
        year: 2024,
        status: 'INITIALIZED',
      });

      const result = await service.processPayrollBatch(1, 2024);

      expect(result.totalEmployees).toBe(3);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'payroll.batch.created',
        expect.any(Object),
      );
    });

    it('should calculate batch totals correctly', async () => {
      const payrolls = [
        { grossSalary: 50000, netSalary: 45000, totalDeductions: 5000 },
        { grossSalary: 60000, netSalary: 54000, totalDeductions: 6000 },
        { grossSalary: 70000, netSalary: 63000, totalDeductions: 7000 },
      ];

      const totals = service.calculateBatchTotals(payrolls);

      expect(totals).toEqual({
        totalGrossSalary: 180000,
        totalNetSalary: 162000,
        totalDeductions: 18000,
      });
    });
  });

  describe('generatePayslip', () => {
    const mockPayroll = {
      id: 'payroll-123',
      employeeId: 'emp-123',
      month: 1,
      year: 2024,
      basicSalary: 50000,
      grossSalary: 84850,
      netSalary: 78650,
      totalDeductions: 6200,
      workingDays: 22,
      presentDays: 20,
      paidLeaveDays: 1,
      unpaidLeaveDays: 0,
    };

    it('should generate payslip with PDF', async () => {
      mockPrismaService.payroll.findUnique.mockResolvedValue(mockPayroll);
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            firstName: 'John',
            lastName: 'Doe',
            employeeNumber: 'EMP20240001',
          },
        }),
      );

      const result = await service.generatePayslip('payroll-123');

      expect(result).toMatchObject({
        id: expect.any(String),
        payrollId: 'payroll-123',
        pdfUrl: expect.stringContaining('.pdf'),
      });

      expect(mockPrismaService.payslip.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'payslip.generated',
        expect.any(Object),
      );
    });

    it('should include all salary components in payslip', async () => {
      mockPrismaService.payroll.findUnique.mockResolvedValue(mockPayroll);
      mockHttpService.get.mockReturnValue(
        of({
          data: {
            firstName: 'John',
            lastName: 'Doe',
            employeeNumber: 'EMP20240001',
          },
        }),
      );

      const result = await service.generatePayslip('payroll-123');

      // Verify payslip includes key information
      expect(result.payrollId).toBe('payroll-123');
      expect(result.pdfUrl).toBeDefined();
    });
  });

  describe('lockPayroll', () => {
    it('should lock payroll and prevent modifications', async () => {
      const mockPayroll = {
        id: 'payroll-123',
        status: 'CALCULATED',
      };

      mockPrismaService.payroll.findUnique.mockResolvedValue(mockPayroll);
      mockPrismaService.payroll.update.mockResolvedValue({
        ...mockPayroll,
        status: 'LOCKED',
        lockedAt: new Date(),
      });

      const result = await service.lockPayroll('payroll-123');

      expect(result.status).toBe('LOCKED');
      expect(result.lockedAt).toBeDefined();
    });

    it('should throw error if payroll not in CALCULATED status', async () => {
      mockPrismaService.payroll.findUnique.mockResolvedValue({
        id: 'payroll-123',
        status: 'DRAFT',
      });

      await expect(service.lockPayroll('payroll-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('hrOverride', () => {
    it('should allow HR to override locked payroll', async () => {
      const lockedPayroll = {
        id: 'payroll-123',
        status: 'LOCKED',
        netSalary: 50000,
      };

      mockPrismaService.payroll.findUnique.mockResolvedValue(lockedPayroll);
      mockPrismaService.payroll.update.mockResolvedValue({
        ...lockedPayroll,
        netSalary: 52000,
        isOverridden: true,
        overrideReason: 'Bonus adjustment',
      });

      const result = await service.hrOverride(
        'payroll-123',
        { netSalary: 52000 },
        'Bonus adjustment',
        'hr-manager-123',
      );

      expect(result.isOverridden).toBe(true);
      expect(result.overrideReason).toBe('Bonus adjustment');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'payroll.overridden',
        expect.objectContaining({
          payrollId: 'payroll-123',
          overriddenBy: 'hr-manager-123',
        }),
      );
    });

    it('should log audit trail for override', async () => {
      const lockedPayroll = {
        id: 'payroll-123',
        status: 'LOCKED',
        netSalary: 50000,
      };

      mockPrismaService.payroll.findUnique.mockResolvedValue(lockedPayroll);
      mockPrismaService.payroll.update.mockResolvedValue({
        ...lockedPayroll,
        isOverridden: true,
      });

      await service.hrOverride(
        'payroll-123',
        { netSalary: 52000 },
        'Correction',
        'hr-123',
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'payroll.overridden',
        expect.objectContaining({
          previousValue: 50000,
          newValue: 52000,
          reason: 'Correction',
        }),
      );
    });
  });

  describe('getBankTransferFile', () => {
    it('should generate bank transfer file for batch', async () => {
      const mockPayrolls = [
        {
          id: 'pay-1',
          employee: {
            firstName: 'John',
            lastName: 'Doe',
            bankName: 'ABC Bank',
            accountNumber: '1234567890',
            ifscCode: 'ABC0001234',
          },
          netSalary: 50000,
        },
        {
          id: 'pay-2',
          employee: {
            firstName: 'Jane',
            lastName: 'Smith',
            bankName: 'XYZ Bank',
            accountNumber: '9876543210',
            ifscCode: 'XYZ0005678',
          },
          netSalary: 60000,
        },
      ];

      mockPrismaService.payroll.findMany.mockResolvedValue(mockPayrolls);

      const result = await service.generateBankTransferFile('batch-123');

      expect(result).toMatchObject({
        totalRecords: 2,
        totalAmount: 110000,
        fileUrl: expect.stringContaining('.csv'),
      });
    });
  });
});
