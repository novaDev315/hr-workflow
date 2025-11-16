import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { EmployeeStatus } from '@prisma/client';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    // Check for duplicate email
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { email: createEmployeeDto.email },
    });

    if (existingEmployee) {
      throw new ConflictException('Employee with this email already exists');
    }

    // Generate employee number
    const employeeNumber = await this.generateEmployeeNumber();

    // Create employee
    const employee = await this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        employeeNumber,
      },
      include: {
        department: true,
        designation: true,
        supervisor: true,
      },
    });

    // Publish event
    this.eventEmitter.emit('employee.created', {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      departmentId: employee.departmentId,
      designationId: employee.designationId,
      joinDate: employee.joinDate,
      status: employee.status,
    });

    return employee;
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        designation: true,
        supervisor: true,
        subordinates: true,
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        salaryStructures: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return employee;
  }

  async findByEmployeeNumber(employeeNumber: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeNumber },
      include: {
        department: true,
        designation: true,
        supervisor: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with number ${employeeNumber} not found`);
    }

    return employee;
  }

  async findAll(filter?: any, pagination?: any) {
    const where: any = {};

    if (filter?.search) {
      where.OR = [
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
        { employeeNumber: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter?.departmentIds?.length) {
      where.departmentId = { in: filter.departmentIds };
    }

    if (filter?.status?.length) {
      where.status = { in: filter.status };
    }

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: {
          department: true,
          designation: true,
          supervisor: true,
        },
        skip: pagination?.offset || 0,
        take: pagination?.limit || 50,
        orderBy: pagination?.orderBy || { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employees,
      total,
      hasMore: (pagination?.offset || 0) + employees.length < total,
    };
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.findOne(id);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateEmployeeDto,
      include: {
        department: true,
        designation: true,
        supervisor: true,
      },
    });

    // Publish event if status or key fields changed
    if (
      employee.status !== updated.status ||
      employee.departmentId !== updated.departmentId
    ) {
      this.eventEmitter.emit('employee.updated', {
        employeeId: updated.id,
        previousStatus: employee.status,
        newStatus: updated.status,
        previousDepartmentId: employee.departmentId,
        newDepartmentId: updated.departmentId,
      });
    }

    return updated;
  }

  async changeStatus(id: string, status: EmployeeStatus, reason?: string) {
    const employee = await this.findOne(id);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        status,
        exitDate:
          status === EmployeeStatus.TERMINATED || status === EmployeeStatus.RESIGNED
            ? new Date()
            : employee.exitDate,
      },
      include: {
        department: true,
        designation: true,
      },
    });

    // Publish event
    this.eventEmitter.emit('employee.status.changed', {
      employeeId: id,
      previousStatus: employee.status,
      newStatus: status,
      reason,
    });

    return updated;
  }

  async delete(id: string) {
    await this.findOne(id);

    await this.prisma.employee.delete({
      where: { id },
    });

    // Publish event
    this.eventEmitter.emit('employee.deleted', {
      employeeId: id,
    });

    return true;
  }

  private async generateEmployeeNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = 'EMP';

    // Get the last employee number for this year
    const lastEmployee = await this.prisma.employee.findFirst({
      where: {
        employeeNumber: {
          startsWith: `${prefix}${year}`,
        },
      },
      orderBy: {
        employeeNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastEmployee) {
      const lastSequence = parseInt(lastEmployee.employeeNumber.slice(-4), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${year}${sequence.toString().padStart(4, '0')}`;
  }

  async getCurrentSalary(employeeId: string) {
    return this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        isCurrent: true,
      },
    });
  }
}
