import { Test, TestingModule } from '@nestjs/testing';
import { LocationService } from './location.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('LocationService', () => {
  let service: LocationService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockPrismaService = {
    client: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    clientLocation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    clientContract: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    employeeLocationAssignment: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
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

    service = module.get<LocationService>(LocationService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createClient', () => {
    const createClientDto = {
      name: 'ABC Corporation',
      code: 'ABC001',
      industry: 'Technology',
      contactPerson: 'John Doe',
      contactEmail: 'john@abc.com',
      contactPhone: '+1234567890',
      address: '123 Business St',
    };

    it('should create a client successfully', async () => {
      const mockClient = {
        id: 'client-123',
        ...createClientDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.create.mockResolvedValue(mockClient);

      const result = await service.createClient(createClientDto);

      expect(result).toEqual(mockClient);
      expect(mockPrismaService.client.create).toHaveBeenCalledWith({
        data: createClientDto,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'client.created',
        expect.objectContaining({ clientId: mockClient.id }),
      );
    });
  });

  describe('createLocation', () => {
    const createLocationDto = {
      clientId: 'client-123',
      name: 'Headquarters',
      code: 'HQ-001',
      latitude: 40.7128,
      longitude: -74.006,
      geofenceRadius: 100,
      address: '123 Main St, New York, NY',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
    };

    it('should create location with valid GPS coordinates', async () => {
      const mockLocation = {
        id: 'loc-123',
        ...createLocationDto,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.clientLocation.create.mockResolvedValue(mockLocation);

      const result = await service.createLocation(createLocationDto);

      expect(result).toEqual(mockLocation);
      expect(mockPrismaService.clientLocation.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'location.created',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException for invalid coordinates', async () => {
      const invalidCoords = {
        ...createLocationDto,
        latitude: 91, // Invalid: > 90
        longitude: -74.006,
      };

      await expect(service.createLocation(invalidCoords)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid geofence radius', async () => {
      const invalidRadius = {
        ...createLocationDto,
        geofenceRadius: 30, // Invalid: < 50m minimum
      };

      await expect(service.createLocation(invalidRadius)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyGeofence', () => {
    const mockLocation = {
      id: 'loc-123',
      latitude: 40.7128,
      longitude: -74.006,
      geofenceRadius: 100,
    };

    beforeEach(() => {
      mockPrismaService.clientLocation.findUnique.mockResolvedValue(mockLocation);
    });

    it('should return true when within geofence', async () => {
      // User coordinates very close to location (within 100m)
      const userLat = 40.7129;
      const userLon = -74.006;

      const result = await service.verifyGeofence('loc-123', userLat, userLon);

      expect(result.isWithinGeofence).toBe(true);
      expect(result.distance).toBeLessThan(100);
    });

    it('should return false when outside geofence', async () => {
      // User coordinates far from location (> 100m)
      const userLat = 40.7138; // ~1km away
      const userLon = -74.006;

      const result = await service.verifyGeofence('loc-123', userLat, userLon);

      expect(result.isWithinGeofence).toBe(false);
      expect(result.distance).toBeGreaterThan(100);
    });

    it('should calculate distance accurately using Haversine formula', async () => {
      // Known distance test case
      const userLat = 40.7128;
      const userLon = -74.005; // ~100m east

      const result = await service.verifyGeofence('loc-123', userLat, userLon);

      // Distance should be approximately 100m (within margin of error)
      expect(result.distance).toBeGreaterThan(80);
      expect(result.distance).toBeLessThan(120);
    });

    it('should provide distance from boundary', async () => {
      const userLat = 40.71285; // ~50m away
      const userLon = -74.006;

      const result = await service.verifyGeofence('loc-123', userLat, userLon);

      expect(result.distanceFromBoundary).toBeDefined();
      expect(result.radius).toBe(100);
    });

    it('should throw NotFoundException if location not found', async () => {
      mockPrismaService.clientLocation.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyGeofence('non-existent', 40.7128, -74.006),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateDistance (Haversine)', () => {
    it('should calculate zero distance for same coordinates', () => {
      const distance = service.calculateDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBe(0);
    });

    it('should calculate correct distance between known points', () => {
      // New York to Los Angeles: ~3936 km
      const nyLat = 40.7128;
      const nyLon = -74.006;
      const laLat = 34.0522;
      const laLon = -118.2437;

      const distance = service.calculateDistance(nyLat, nyLon, laLat, laLon);

      // Distance should be approximately 3,936,000 meters
      expect(distance).toBeGreaterThan(3_900_000);
      expect(distance).toBeLessThan(4_000_000);
    });

    it('should handle coordinates across date line', () => {
      const distance = service.calculateDistance(0, 179, 0, -179);
      // Should calculate the shorter distance, not the long way around
      expect(distance).toBeLessThan(300_000); // ~223km
    });
  });

  describe('assignEmployeeToLocation', () => {
    const assignmentDto = {
      employeeId: 'emp-123',
      locationId: 'loc-123',
      isPrimary: false,
      assignedDate: new Date('2024-01-01'),
    };

    it('should assign employee to location', async () => {
      const mockAssignment = {
        id: 'assign-123',
        ...assignmentDto,
        status: 'ACTIVE',
        createdAt: new Date(),
      };

      mockPrismaService.clientLocation.findUnique.mockResolvedValue({
        id: 'loc-123',
        isActive: true,
      });
      mockPrismaService.employeeLocationAssignment.findMany.mockResolvedValue([]);
      mockPrismaService.employeeLocationAssignment.create.mockResolvedValue(mockAssignment);

      const result = await service.assignEmployeeToLocation(assignmentDto);

      expect(result).toEqual(mockAssignment);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'employee.assigned.to.location',
        expect.any(Object),
      );
    });

    it('should set as primary location if first assignment', async () => {
      const firstAssignment = {
        ...assignmentDto,
        isPrimary: false, // Even if not specified, should become primary
      };

      mockPrismaService.clientLocation.findUnique.mockResolvedValue({
        id: 'loc-123',
        isActive: true,
      });
      mockPrismaService.employeeLocationAssignment.findMany.mockResolvedValue([]);
      mockPrismaService.employeeLocationAssignment.create.mockResolvedValue({
        ...firstAssignment,
        isPrimary: true, // Should be automatically set
      });

      const result = await service.assignEmployeeToLocation(firstAssignment);

      expect(result.isPrimary).toBe(true);
    });

    it('should unset previous primary when setting new primary', async () => {
      const newPrimaryAssignment = {
        ...assignmentDto,
        isPrimary: true,
      };

      const existingPrimary = {
        id: 'assign-old',
        employeeId: 'emp-123',
        isPrimary: true,
      };

      mockPrismaService.clientLocation.findUnique.mockResolvedValue({
        id: 'loc-123',
        isActive: true,
      });
      mockPrismaService.employeeLocationAssignment.findMany.mockResolvedValue([
        existingPrimary,
      ]);
      mockPrismaService.employeeLocationAssignment.create.mockResolvedValue({
        ...newPrimaryAssignment,
      });

      await service.assignEmployeeToLocation(newPrimaryAssignment);

      expect(mockPrismaService.employeeLocationAssignment.updateMany).toHaveBeenCalledWith({
        where: {
          employeeId: 'emp-123',
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    });

    it('should limit employee to maximum 5 active locations', async () => {
      const existingAssignments = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `assign-${i}`,
          status: 'ACTIVE',
        }));

      mockPrismaService.clientLocation.findUnique.mockResolvedValue({
        id: 'loc-123',
        isActive: true,
      });
      mockPrismaService.employeeLocationAssignment.findMany.mockResolvedValue(
        existingAssignments,
      );

      await expect(service.assignEmployeeToLocation(assignmentDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createClientContract', () => {
    const contractDto = {
      clientId: 'client-123',
      contractNumber: 'CT-2024-001',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'),
      contractValue: 5000000,
      requiredPersonnel: 95,
      genderRequirement: 'MIXED',
      maleCount: 70,
      femaleCount: 25,
      numberOfLocations: 3,
    };

    it('should create contract with valid personnel requirements', async () => {
      const mockContract = {
        id: 'contract-123',
        ...contractDto,
        status: 'ACTIVE',
        createdAt: new Date(),
      };

      mockPrismaService.clientContract.create.mockResolvedValue(mockContract);

      const result = await service.createClientContract(contractDto);

      expect(result).toEqual(mockContract);
      expect(mockPrismaService.clientContract.create).toHaveBeenCalled();
    });

    it('should validate gender requirements match personnel count', async () => {
      const invalidGender = {
        ...contractDto,
        requiredPersonnel: 100,
        genderRequirement: 'MIXED',
        maleCount: 70,
        femaleCount: 25, // Only 95, but required is 100
      };

      await expect(service.createClientContract(invalidGender)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate MALE_ONLY requirement', async () => {
      const maleOnly = {
        ...contractDto,
        requiredPersonnel: 50,
        genderRequirement: 'MALE_ONLY',
        maleCount: 50,
        femaleCount: 0,
      };

      mockPrismaService.clientContract.create.mockResolvedValue(maleOnly);

      const result = await service.createClientContract(maleOnly);
      expect(result).toBeDefined();
    });

    it('should validate FEMALE_ONLY requirement', async () => {
      const femaleOnly = {
        ...contractDto,
        requiredPersonnel: 30,
        genderRequirement: 'FEMALE_ONLY',
        maleCount: 0,
        femaleCount: 30,
      };

      mockPrismaService.clientContract.create.mockResolvedValue(femaleOnly);

      const result = await service.createClientContract(femaleOnly);
      expect(result).toBeDefined();
    });

    it('should calculate contract period in months', async () => {
      const result = service.calculateContractPeriod(
        new Date('2024-01-01'),
        new Date('2026-12-31'),
      );

      expect(result).toBe(36); // 3 years = 36 months
    });
  });

  describe('getActiveLocations', () => {
    it('should return only active locations', async () => {
      const mockLocations = [
        { id: 'loc-1', name: 'Location 1', isActive: true },
        { id: 'loc-2', name: 'Location 2', isActive: true },
      ];

      mockPrismaService.clientLocation.findMany.mockResolvedValue(mockLocations);

      const result = await service.getActiveLocations();

      expect(result).toEqual(mockLocations);
      expect(mockPrismaService.clientLocation.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.any(Object),
      });
    });
  });
});
