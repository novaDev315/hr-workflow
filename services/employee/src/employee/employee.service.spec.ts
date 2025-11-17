import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let prisma: PrismaService;

  const mockPrismaService = {
    employee: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new employee with auto-generated employee number', async () => {
      const createEmployeeDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        departmentId: 'dept-1',
        designationId: 'desig-1',
        employmentType: 'FULL_TIME',
        joinDate: new Date('2024-01-01'),
      };

      const mockEmployee = {
        id: 'emp-1',
        employeeNumber: 'EMP20240001',
        ...createEmployeeDto,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.employee.findFirst.mockResolvedValue(null);
      mockPrismaService.employee.create.mockResolvedValue(mockEmployee);

      const result = await service.create(createEmployeeDto);

      expect(result).toEqual(mockEmployee);
      expect(result.employeeNumber).toMatch(/^EMP\d{8}$/);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'employee.created',
        expect.any(Object),
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of employees', async () => {
      const mockEmployees = [
        {
          id: 'emp-1',
          employeeNumber: 'EMP20240001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
        },
      ];

      mockPrismaService.employee.findMany.mockResolvedValue(mockEmployees);

      const result = await service.findAll();

      expect(result).toEqual(mockEmployees);
    });
  });

  describe('findOne', () => {
    it('should return a single employee', async () => {
      const mockEmployee = {
        id: 'emp-1',
        employeeNumber: 'EMP20240001',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockPrismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      const result = await service.findOne('emp-1');

      expect(result).toEqual(mockEmployee);
    });

    it('should throw NotFoundException if employee not found', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow();
    });
  });
});
