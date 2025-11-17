import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get leave balance for employee
   */
  async getBalance(employeeId: string, leaveTypeId: string, year: number) {
    let balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year,
        },
      },
      include: {
        leaveType: true,
      },
    });

    // If balance doesn't exist, initialize it
    if (!balance) {
      balance = await this.initializeBalance(employeeId, leaveTypeId, year);
    }

    return balance;
  }

  /**
   * Initialize leave balance for employee
   */
  async initializeBalance(employeeId: string, leaveTypeId: string, year: number) {
    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
      include: {
        policies: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    const policy = leaveType.policies[0];
    const totalEntitlement = policy
      ? this.calculateYearlyEntitlement(policy.accrualType, policy.accrualRate.toNumber())
      : 0;

    // Check for carryover from previous year
    let carriedOver = 0;
    if (policy?.allowCarryover) {
      const previousBalance = await this.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId,
            year: year - 1,
          },
        },
      });

      if (previousBalance) {
        const unusedBalance = previousBalance.available.toNumber();
        carriedOver = Math.min(
          unusedBalance,
          policy.maxCarryoverDays || unusedBalance,
        );
      }
    }

    const available = totalEntitlement + carriedOver;

    return this.prisma.leaveBalance.create({
      data: {
        employeeId,
        leaveTypeId,
        year,
        totalEntitlement: new Decimal(totalEntitlement),
        used: new Decimal(0),
        pending: new Decimal(0),
        available: new Decimal(available),
        carriedOver: new Decimal(carriedOver),
      },
      include: {
        leaveType: true,
      },
    });
  }

  /**
   * Calculate yearly entitlement based on accrual type
   */
  private calculateYearlyEntitlement(accrualType: string, accrualRate: number): number {
    switch (accrualType) {
      case 'MONTHLY':
        return accrualRate * 12;
      case 'QUARTERLY':
        return accrualRate * 4;
      case 'YEARLY':
      case 'ON_JOINING':
      case 'ANNIVERSARY':
        return accrualRate;
      default:
        return 0;
    }
  }

  /**
   * Update pending leave balance
   */
  async updatePending(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
  ) {
    const balance = await this.getBalance(employeeId, leaveTypeId, year);

    const newPending = balance.pending.toNumber() + days;
    const newAvailable = balance.totalEntitlement.toNumber() +
      balance.carriedOver.toNumber() -
      balance.used.toNumber() -
      newPending;

    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        pending: new Decimal(newPending),
        available: new Decimal(newAvailable),
      },
    });
  }

  /**
   * Approve leave - move from pending to used
   */
  async approveLeave(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
  ) {
    const balance = await this.getBalance(employeeId, leaveTypeId, year);

    const newUsed = balance.used.toNumber() + days;
    const newPending = balance.pending.toNumber() - days;
    const newAvailable = balance.totalEntitlement.toNumber() +
      balance.carriedOver.toNumber() -
      newUsed -
      newPending;

    return this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        used: new Decimal(newUsed),
        pending: new Decimal(newPending),
        available: new Decimal(newAvailable),
      },
    });
  }

  /**
   * Reject leave - release pending balance
   */
  async rejectLeave(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
  ) {
    return this.updatePending(employeeId, leaveTypeId, year, -days);
  }

  /**
   * Get all balances for employee
   */
  async getAllBalances(employeeId: string, year: number) {
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { isActive: true },
    });

    const balances = [];

    for (const leaveType of leaveTypes) {
      const balance = await this.getBalance(employeeId, leaveType.id, year);
      balances.push(balance);
    }

    return balances;
  }

  /**
   * Process monthly accrual for all employees
   */
  async processMonthlyAccrual(year: number, month: number) {
    const policies = await this.prisma.leavePolicy.findMany({
      where: {
        isActive: true,
        accrualType: 'MONTHLY',
      },
      include: {
        leaveType: true,
      },
    });

    const results = [];

    for (const policy of policies) {
      // This would typically query all active employees
      // For now, we'll update existing balances
      const balances = await this.prisma.leaveBalance.findMany({
        where: {
          leaveTypeId: policy.leaveTypeId,
          year,
        },
      });

      for (const balance of balances) {
        const accrualAmount = policy.accrualRate.toNumber();
        const newTotal = balance.totalEntitlement.toNumber() + accrualAmount;

        // Check max accrual limit
        const maxAccrual = policy.maxAccrual;
        const finalTotal = maxAccrual ? Math.min(newTotal, maxAccrual) : newTotal;

        const newAvailable = finalTotal -
          balance.used.toNumber() -
          balance.pending.toNumber();

        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            totalEntitlement: new Decimal(finalTotal),
            available: new Decimal(newAvailable),
            lastAccrualDate: new Date(),
          },
        });

        results.push({
          employeeId: balance.employeeId,
          leaveTypeId: balance.leaveTypeId,
          accrued: accrualAmount,
          totalEntitlement: finalTotal,
        });
      }
    }

    return results;
  }

  /**
   * Get balance summary for employee
   */
  async getBalanceSummary(employeeId: string, year: number) {
    const balances = await this.getAllBalances(employeeId, year);

    return {
      year,
      totalTypes: balances.length,
      totalEntitlement: balances.reduce(
        (sum, b) => sum + b.totalEntitlement.toNumber(),
        0,
      ),
      totalUsed: balances.reduce((sum, b) => sum + b.used.toNumber(), 0),
      totalPending: balances.reduce((sum, b) => sum + b.pending.toNumber(), 0),
      totalAvailable: balances.reduce(
        (sum, b) => sum + b.available.toNumber(),
        0,
      ),
      balances,
    };
  }
}
