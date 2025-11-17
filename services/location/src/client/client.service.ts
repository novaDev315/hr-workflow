import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.client.create({
      data,
      include: {
        contracts: true,
        locations: true,
      },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        contracts: true,
        locations: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async findAll(filter?: any) {
    return this.prisma.client.findMany({
      where: filter,
      include: {
        contracts: true,
        locations: true,
      },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);

    return this.prisma.client.update({
      where: { id },
      data,
      include: {
        contracts: true,
        locations: true,
      },
    });
  }
}
