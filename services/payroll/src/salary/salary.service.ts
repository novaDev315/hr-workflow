import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create salary structure for employee
   */
  async createSalaryStructure(data: {
    employeeId: string;
    basicSalary: number;
    hra: number;
    conveyanceAllowance?: number;
    medicalAllowance?: number;
    specialAllowance?: number;
    otherAllowances?: number;
    effectiveFrom: string;
    createdBy?: string;
  }) {
    // Mark existing structures as not current
    await this.prisma.salaryStructure.updateMany({
      where: {
        employeeId: data.employeeId,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    // Calculate gross salary
    const grossSalary =
      data.basicSalary +
      data.hra +
      (data.conveyanceAllowance || 0) +
      (data.medicalAllowance || 0) +
      (data.specialAllowance || 0) +
      (data.otherAllowances || 0);

    // Calculate deductions (simplified)
    const pfEmployee = Math.min(data.basicSalary, 15000) * 0.12;
    const pfEmployer = Math.min(data.basicSalary, 15000) * 0.12;

    let esiEmployee = 0;
    let esiEmployer = 0;
    if (grossSalary < 21000) {
      esiEmployee = grossSalary * 0.0075;
      esiEmployer = grossSalary * 0.0325;
    }

    let professionalTax = 0;
    if (grossSalary > 15000 && grossSalary <= 20000) {
      professionalTax = 150;
    } else if (grossSalary > 20000) {
      professionalTax = 200;
    }

    const totalDeductions = pfEmployee + esiEmployee + professionalTax;
    const netSalary = grossSalary - totalDeductions;

    // Create new structure
    return this.prisma.salaryStructure.create({
      data: {
        employeeId: data.employeeId,
        basicSalary: new Decimal(data.basicSalary),
        hra: new Decimal(data.hra),
        conveyanceAllowance: new Decimal(data.conveyanceAllowance || 0),
        medicalAllowance: new Decimal(data.medicalAllowance || 0),
        specialAllowance: new Decimal(data.specialAllowance || 0),
        otherAllowances: new Decimal(data.otherAllowances || 0),
        grossSalary: new Decimal(grossSalary),
        pfEmployeeContribution: new Decimal(pfEmployee),
        pfEmployerContribution: new Decimal(pfEmployer),
        esiEmployeeContribution: new Decimal(esiEmployee),
        esiEmployerContribution: new Decimal(esiEmployer),
        professionalTax: new Decimal(professionalTax),
        netSalary: new Decimal(netSalary),
        effectiveFrom: new Date(data.effectiveFrom),
        isCurrent: true,
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Get current salary structure for employee
   */
  async getCurrentSalaryStructure(employeeId: string) {
    const structure = await this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        isCurrent: true,
      },
    });

    if (!structure) {
      throw new NotFoundException('No salary structure found for employee');
    }

    return structure;
  }

  /**
   * Get all salary structures for employee
   */
  async getEmployeeSalaryHistory(employeeId: string) {
    return this.prisma.salaryStructure.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Update salary structure
   */
  async updateSalaryStructure(
    structureId: string,
    data: {
      basicSalary?: number;
      hra?: number;
      conveyanceAllowance?: number;
      medicalAllowance?: number;
      specialAllowance?: number;
      otherAllowances?: number;
    },
  ) {
    const structure = await this.prisma.salaryStructure.findUnique({
      where: { id: structureId },
    });

    if (!structure) {
      throw new NotFoundException('Salary structure not found');
    }

    // Recalculate gross and net salary
    const basicSalary = data.basicSalary || structure.basicSalary.toNumber();
    const hra = data.hra || structure.hra.toNumber();
    const conveyance =
      data.conveyanceAllowance || structure.conveyanceAllowance.toNumber();
    const medical =
      data.medicalAllowance || structure.medicalAllowance.toNumber();
    const special =
      data.specialAllowance || structure.specialAllowance.toNumber();
    const other =
      data.otherAllowances || structure.otherAllowances.toNumber();

    const grossSalary =
      basicSalary + hra + conveyance + medical + special + other;

    const pfEmployee = Math.min(basicSalary, 15000) * 0.12;
    const esiEmployee = grossSalary < 21000 ? grossSalary * 0.0075 : 0;
    const professionalTax =
      grossSalary > 20000 ? 200 : grossSalary > 15000 ? 150 : 0;

    const totalDeductions = pfEmployee + esiEmployee + professionalTax;
    const netSalary = grossSalary - totalDeductions;

    return this.prisma.salaryStructure.update({
      where: { id: structureId },
      data: {
        ...data,
        grossSalary: new Decimal(grossSalary),
        netSalary: new Decimal(netSalary),
        pfEmployeeContribution: new Decimal(pfEmployee),
        esiEmployeeContribution: new Decimal(esiEmployee),
        professionalTax: new Decimal(professionalTax),
      },
    });
  }

  /**
   * Deactivate salary structure
   */
  async deactivateSalaryStructure(structureId: string, effectiveTo: string) {
    return this.prisma.salaryStructure.update({
      where: { id: structureId },
      data: {
        effectiveTo: new Date(effectiveTo),
        isCurrent: false,
      },
    });
  }
}
