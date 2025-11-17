import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockPrismaService = {
    employee: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    designation: {
      findUnique: jest.fn(),
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
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createEmployeeDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      departmentId: 'dept-123',
      designationId: 'desig-123',
      employmentType: 'FULL_TIME',
      joinDate: new Date('2024-01-01'),
    };

    it('should create an employee successfully', async () => {
      const mockEmployee = {
        id: 'emp-123',
        employeeNumber: 'EMP20240001',
        ...createEmployeeDto,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        department: { id: 'dept-123', name: 'Engineering' },
        designation: { id: 'desig-123', title: 'Software Engineer' },
      };

      mockPrismaService.employee.findUnique.mockResolvedValue(null);
      mockPrismaService.employee.findFirst.mockResolvedValue(null);
      mockPrismaService.employee.create.mockResolvedValue(mockEmployee);

      const result = await service.create(createEmployeeDto);

      expect(result).toEqual(mockEmployee);
      expect(mockPrismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { email: createEmployeeDto.email },
      });
      expect(mockPrismaService.employee.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'employee.created',
        expect.objectContaining({
          employeeId: mockEmployee.id,
          employeeNumber: mockEmployee.employeeNumber,
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 'existing-emp',
        email: createEmployeeDto.email,
      });

      await expect(service.create(createEmployeeDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.employee.create).not.toHaveBeenCalled();
    });

    it('should generate sequential employee numbers', async () => {
      const year = new Date().getFullYear();
      const lastEmployee = {
        employeeNumber: `EMP${year}0005`,
      };

      mockPrismaService.employee.findUnique.mockResolvedValue(null);
      mockPrismaService.employee.findFirst.mockResolvedValue(lastEmployee);
      mockPrismaService.employee.create.mockResolvedValue({
        id: 'emp-new',
        employeeNumber: `EMP${year}0006`,
        ...createEmployeeDto,
      });

      const result = await service.create(createEmployeeDto);

      expect(result.employeeNumber).toBe(`EMP${year}0006`);
    });
  });

  describe('findOne', () => {
    it('should return an employee by id', async () => {
      const mockEmployee = {
        id: 'emp-123',
        employeeNumber: 'EMP20240001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        department: { id: 'dept-123', name: 'Engineering' },
        designation: { id: 'desig-123', title: 'Software Engineer' },
      };

      mockPrismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      const result = await service.findOne('emp-123');

      expect(result).toEqual(mockEmployee);
      expect(mockPrismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-123' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if employee not found', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated employees', async () => {
      const mockEmployees = [
        {
          id: 'emp-1',
          employeeNumber: 'EMP20240001',
          firstName: 'John',
          lastName: 'Doe',
        },
        {
          id: 'emp-2',
          employeeNumber: 'EMP20240002',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      ];

      mockPrismaService.employee.findMany.mockResolvedValue(mockEmployees);
      mockPrismaService.employee.count.mockResolvedValue(2);

      const result = await service.findAll({}, { limit: 10, offset: 0 });

      expect(result.data).toEqual(mockEmployees);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter employees by search query', async () => {
      const filter = { search: 'john' };
      mockPrismaService.employee.findMany.mockResolvedValue([]);
      mockPrismaService.employee.count.mockResolvedValue(0);

      await service.findAll(filter, {});

      expect(mockPrismaService.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                firstName: expect.objectContaining({ contains: 'john' }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should filter employees by department', async () => {
      const filter = { departmentIds: ['dept-123', 'dept-456'] };
      mockPrismaService.employee.findMany.mockResolvedValue([]);
      mockPrismaService.employee.count.mockResolvedValue(0);

      await service.findAll(filter, {});

      expect(mockPrismaService.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: { in: ['dept-123', 'dept-456'] },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an employee', async () => {
      const existingEmployee = {
        id: 'emp-123',
        status: 'ACTIVE',
        departmentId: 'dept-123',
      };
      const updateDto = { firstName: 'John Updated' };
      const updatedEmployee = { ...existingEmployee, ...updateDto };

      mockPrismaService.employee.findUnique.mockResolvedValue(
        existingEmployee,
      );
      mockPrismaService.employee.update.mockResolvedValue(updatedEmployee);

      const result = await service.update('emp-123', updateDto);

      expect(result).toEqual(updatedEmployee);
      expect(mockPrismaService.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-123' },
        data: updateDto,
        include: expect.any(Object),
      });
    });

    it('should emit event when status changes', async () => {
      const existingEmployee = {
        id: 'emp-123',
        status: 'ACTIVE',
        departmentId: 'dept-123',
      };
      const updateDto = { status: 'SUSPENDED' };
      const updatedEmployee = { ...existingEmployee, status: 'SUSPENDED' };

      mockPrismaService.employee.findUnique.mockResolvedValue(
        existingEmployee,
      );
      mockPrismaService.employee.update.mockResolvedValue(updatedEmployee);

      await service.update('emp-123', updateDto);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'employee.updated',
        expect.objectContaining({
          employeeId: 'emp-123',
          previousStatus: 'ACTIVE',
          newStatus: 'SUSPENDED',
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete an employee', async () => {
      const mockEmployee = { id: 'emp-123' };
      mockPrismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrismaService.employee.delete.mockResolvedValue(mockEmployee);

      const result = await service.delete('emp-123');

      expect(result).toBe(true);
      expect(mockPrismaService.employee.delete).toHaveBeenCalledWith({
        where: { id: 'emp-123' },
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('employee.deleted', {
        employeeId: 'emp-123',
      });
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCurrentSalary', () => {
    it('should return current salary structure', async () => {
      const mockSalary = {
        id: 'salary-123',
        employeeId: 'emp-123',
        basicSalary: 50000,
        isCurrent: true,
      };

      mockPrismaService.salaryStructure = {
        findFirst: jest.fn().mockResolvedValue(mockSalary),
      };

      const result = await service.getCurrentSalary('emp-123');

      expect(result).toEqual(mockSalary);
    });
  });
});
