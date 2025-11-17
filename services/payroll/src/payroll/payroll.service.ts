import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { TaxService } from '../tax/tax.service';
import { firstValueFrom } from 'rxjs';
import { format, getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly taxService: TaxService,
  ) {}

  /**
   * Create payroll period
   */
  async createPayrollPeriod(year: number, month: number) {
    const periodCode = `${year}-${month.toString().padStart(2, '0')}`;

    // Check if already exists
    const existing = await this.prisma.payrollPeriod.findUnique({
      where: { periodCode },
    });

    if (existing) {
      throw new BadRequestException('Payroll period already exists');
    }

    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(new Date(year, month - 1));

    return this.prisma.payrollPeriod.create({
      data: {
        year,
        month,
        periodCode,
        startDate,
        endDate,
        status: 'OPEN',
      },
    });
  }

  /**
   * Process payroll for a period
   */
  async processPayroll(periodId: string, processedBy: string) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException('Payroll period not found');
    }

    if (period.status !== 'OPEN') {
      throw new BadRequestException('Payroll period is not open for processing');
    }

    // Update status to processing
    await this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: 'PROCESSING' },
    });

    try {
      // Fetch all active employees (would call Employee Service)
      const employees = await this.fetchActiveEmployees();

      const totalEmployees = employees.length;
      let totalGrossSalary = 0;
      let totalDeductions = 0;
      let totalNetSalary = 0;

      // Process each employee
      for (const employee of employees) {
        const record = await this.processEmployeePayroll(
          periodId,
          employee.id,
          period.year,
          period.month,
        );

        totalGrossSalary += record.grossSalary.toNumber();
        totalDeductions += record.totalDeductions.toNumber();
        totalNetSalary += record.netSalary.toNumber();
      }

      // Update period with summary
      await this.prisma.payrollPeriod.update({
        where: { id: periodId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          processedBy,
          totalEmployees,
          totalGrossSalary: new Decimal(totalGrossSalary),
          totalDeductions: new Decimal(totalDeductions),
          totalNetSalary: new Decimal(totalNetSalary),
        },
      });

      return {
        success: true,
        totalEmployees,
        totalGrossSalary,
        totalNetSalary,
      };
    } catch (error) {
      // Rollback to OPEN on error
      await this.prisma.payrollPeriod.update({
        where: { id: periodId },
        data: { status: 'OPEN' },
      });
      throw error;
    }
  }

  /**
   * Process individual employee payroll
   */
  async processEmployeePayroll(
    periodId: string,
    employeeId: string,
    year: number,
    month: number,
  ) {
    // Fetch salary structure
    const salaryStructure = await this.getEmployeeSalaryStructure(employeeId);

    if (!salaryStructure) {
      throw new NotFoundException(
        `No salary structure found for employee ${employeeId}`,
      );
    }

    // Fetch attendance data
    const attendance = await this.fetchEmployeeAttendance(
      employeeId,
      year,
      month,
    );

    // Calculate working days
    const totalWorkingDays = await this.calculateWorkingDays(year, month);

    // Calculate pro-rated salary based on attendance
    const presentDays =
      attendance.presentDays +
      attendance.paidLeaveDays +
      attendance.weekoffs +
      attendance.holidays;

    const paymentRatio = presentDays / totalWorkingDays;

    // Calculate earnings
    const basicSalaryPaid = salaryStructure.basicSalary.toNumber() * paymentRatio;
    const hraPaid = salaryStructure.hra.toNumber() * paymentRatio;
    const conveyancePaid =
      salaryStructure.conveyanceAllowance.toNumber() * paymentRatio;
    const medicalPaid =
      salaryStructure.medicalAllowance.toNumber() * paymentRatio;
    const specialPaid =
      salaryStructure.specialAllowance.toNumber() * paymentRatio;
    const otherAllowancesPaid =
      salaryStructure.otherAllowances.toNumber() * paymentRatio;

    // Calculate overtime
    const overtimeAmount = this.calculateOvertimeAmount(
      attendance.totalOvertimeHours,
      salaryStructure.basicSalary.toNumber(),
    );

    const totalEarnings =
      basicSalaryPaid +
      hraPaid +
      conveyancePaid +
      medicalPaid +
      specialPaid +
      otherAllowancesPaid +
      overtimeAmount;

    // Calculate deductions
    const pfEmployee = this.taxService.calculatePF(basicSalaryPaid);
    const esiEmployee = this.taxService.calculateESI(totalEarnings);
    const professionalTax = this.taxService.calculateProfessionalTax(
      totalEarnings,
    );

    // Get loan deduction
    const loanDeduction = await this.getLoanEMI(employeeId);

    const totalDeductions =
      pfEmployee + esiEmployee + professionalTax + loanDeduction;

    const grossSalary = totalEarnings;
    const netSalary = grossSalary - totalDeductions;

    // Create or update payroll record
    const record = await this.prisma.payrollRecord.upsert({
      where: {
        payrollPeriodId_employeeId: {
          payrollPeriodId: periodId,
          employeeId,
        },
      },
      create: {
        payrollPeriodId: periodId,
        employeeId,
        salaryStructureId: salaryStructure.id,
        totalWorkingDays,
        presentDays: new Decimal(presentDays),
        absentDays: new Decimal(attendance.absentDays),
        leaveDays: new Decimal(attendance.leaveDays),
        paidLeaveDays: new Decimal(attendance.paidLeaveDays),
        unpaidLeaveDays: new Decimal(attendance.unpaidLeaveDays),
        weekoffs: attendance.weekoffs,
        holidays: attendance.holidays,
        totalOvertimeHours: new Decimal(attendance.totalOvertimeHours),
        overtimeAmount: new Decimal(overtimeAmount),
        basicSalaryPaid: new Decimal(basicSalaryPaid),
        hraPaid: new Decimal(hraPaid),
        conveyancePaid: new Decimal(conveyancePaid),
        medicalPaid: new Decimal(medicalPaid),
        specialPaid: new Decimal(specialPaid),
        otherAllowancesPaid: new Decimal(otherAllowancesPaid),
        totalEarnings: new Decimal(totalEarnings),
        pfEmployee: new Decimal(pfEmployee),
        esiEmployee: new Decimal(esiEmployee),
        professionalTax: new Decimal(professionalTax),
        loanDeduction: new Decimal(loanDeduction),
        totalDeductions: new Decimal(totalDeductions),
        grossSalary: new Decimal(grossSalary),
        netSalary: new Decimal(netSalary),
        status: 'CALCULATED',
      },
      update: {
        totalWorkingDays,
        presentDays: new Decimal(presentDays),
        totalEarnings: new Decimal(totalEarnings),
        totalDeductions: new Decimal(totalDeductions),
        grossSalary: new Decimal(grossSalary),
        netSalary: new Decimal(netSalary),
        status: 'CALCULATED',
      },
    });

    return record;
  }

  /**
   * Calculate overtime amount
   */
  private calculateOvertimeAmount(
    overtimeHours: number,
    basicSalary: number,
  ): number {
    // Overtime rate: 1.5x hourly rate
    const hourlyRate = basicSalary / (30 * 8); // Assuming 30 days, 8 hours per day
    return overtimeHours * hourlyRate * 1.5;
  }

  /**
   * Calculate working days in a month (excluding weekends)
   */
  private async calculateWorkingDays(year: number, month: number): Promise<number> {
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();

      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return workingDays;
  }

  /**
   * Apply HR override to payroll record
   */
  async applyOverride(
    recordId: string,
    overriddenBy: string,
    overrides: {
      field: string;
      newValue: number;
      reason: string;
    }[],
  ) {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    const updateData: any = {
      hasOverride: true,
      overriddenBy,
      overriddenAt: new Date(),
    };

    // Apply each override
    for (const override of overrides) {
      const originalValue = record[override.field];

      // Store in override history
      await this.prisma.payrollOverrideHistory.create({
        data: {
          payrollRecordId: recordId,
          field: override.field,
          originalValue: String(originalValue),
          newValue: String(override.newValue),
          reason: override.reason,
          overriddenBy,
        },
      });

      // Update the field
      updateData[override.field] = new Decimal(override.newValue);
    }

    // Recalculate net salary if earnings or deductions changed
    const updatedRecord = await this.prisma.payrollRecord.update({
      where: { id: recordId },
      data: updateData,
    });

    // Recalculate totals
    const newNetSalary =
      updatedRecord.totalEarnings.toNumber() -
      updatedRecord.totalDeductions.toNumber();

    return this.prisma.payrollRecord.update({
      where: { id: recordId },
      data: {
        netSalary: new Decimal(newNetSalary),
        overrideReason: overrides.map((o) => o.reason).join('; '),
      },
    });
  }

  /**
   * Get payroll records for a period
   */
  async getPayrollRecords(periodId: string) {
    return this.prisma.payrollRecord.findMany({
      where: { payrollPeriodId: periodId },
      include: {
        salaryStructure: true,
        adjustments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get employee payroll history
   */
  async getEmployeePayrollHistory(employeeId: string, year?: number) {
    const where: any = { employeeId };

    if (year) {
      where.payrollPeriod = { year };
    }

    return this.prisma.payrollRecord.findMany({
      where,
      include: {
        payrollPeriod: true,
        salaryStructure: true,
      },
      orderBy: {
        payrollPeriod: {
          year: 'desc',
        },
      },
    });
  }

  /**
   * Fetch active employees (mock - would call Employee Service)
   */
  private async fetchActiveEmployees(): Promise<any[]> {
    // In production, this would call the Employee Service GraphQL API
    // For now, we'll fetch from salary structures
    const structures = await this.prisma.salaryStructure.findMany({
      where: { isCurrent: true },
    });

    return structures.map((s) => ({ id: s.employeeId }));
  }

  /**
   * Get employee salary structure
   */
  private async getEmployeeSalaryStructure(employeeId: string) {
    return this.prisma.salaryStructure.findFirst({
      where: {
        employeeId,
        isCurrent: true,
      },
    });
  }

  /**
   * Fetch employee attendance (mock - would call Attendance Service)
   */
  private async fetchEmployeeAttendance(
    employeeId: string,
    year: number,
    month: number,
  ): Promise<{
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    weekoffs: number;
    holidays: number;
    totalOvertimeHours: number;
  }> {
    // In production, this would call Attendance Service GraphQL API
    // Mock data for now
    const workingDays = await this.calculateWorkingDays(year, month);

    return {
      presentDays: workingDays, // All days present for now
      absentDays: 0,
      leaveDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      weekoffs: 8, // Approx 8 weekend days per month
      holidays: 0,
      totalOvertimeHours: 0,
    };
  }

  /**
   * Get loan EMI for employee
   */
  private async getLoanEMI(employeeId: string): Promise<number> {
    const loan = await this.prisma.loan.findFirst({
      where: {
        employeeId,
        status: 'ACTIVE',
      },
    });

    return loan ? loan.emiAmount.toNumber() : 0;
  }

  /**
   * Approve payroll period
   */
  async approvePayrollPeriod(periodId: string, approvedBy: string) {
    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period || period.status !== 'PROCESSED') {
      throw new BadRequestException('Period must be processed before approval');
    }

    return this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
    });
  }

  /**
   * Lock payroll period
   */
  async lockPayrollPeriod(periodId: string, lockedBy: string) {
    return this.prisma.payrollPeriod.update({
      where: { id: periodId },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy,
      },
    });
  }
}
