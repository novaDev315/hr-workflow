import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.report.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(data: any) {
    return this.prisma.report.create({
      data,
    });
  }
}
