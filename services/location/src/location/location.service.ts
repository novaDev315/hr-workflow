import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeofenceService } from '../geofence/geofence.service';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geofence: GeofenceService,
  ) {}

  async findOne(id: string) {
    const location = await this.prisma.clientLocation.findUnique({
      where: { id },
      include: {
        client: true,
        contract: true,
        assignments: true,
      },
    });

    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return location;
  }

  async findAll(filter?: any) {
    return this.prisma.clientLocation.findMany({
      where: filter,
      include: {
        client: true,
        contract: true,
      },
    });
  }

  async validateGeofence(
    locationId: string,
    userLat: number,
    userLon: number,
  ) {
    const location = await this.findOne(locationId);

    return this.geofence.getGeofenceStatus(
      userLat,
      userLon,
      parseFloat(location.latitude.toString()),
      parseFloat(location.longitude.toString()),
      location.geofenceRadius,
    );
  }

  async assignEmployee(employeeId: string, locationId: string, isPrimary = false) {
    await this.findOne(locationId);

    // If setting as primary, unset other primaries
    if (isPrimary) {
      await this.prisma.employeeLocationAssignment.updateMany({
        where: {
          employeeId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.employeeLocationAssignment.create({
      data: {
        employeeId,
        locationId,
        isPrimary,
        status: 'ACTIVE',
      },
      include: {
        location: {
          include: {
            client: true,
          },
        },
      },
    });
  }

  async getEmployeeLocations(employeeId: string) {
    return this.prisma.employeeLocationAssignment.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
      },
      include: {
        location: {
          include: {
            client: true,
          },
        },
      },
    });
  }
}
