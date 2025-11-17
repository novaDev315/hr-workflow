import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate PF (Provident Fund) - Employee Contribution
   * PF is 12% of basic salary (capped at ₹15,000 basic)
   */
  calculatePF(basicSalary: number): number {
    const pfCap = 15000;
    const applicableBasic = Math.min(basicSalary, pfCap);
    return Math.round(applicableBasic * 0.12);
  }

  /**
   * Calculate ESI (Employee State Insurance)
   * ESI is 0.75% of gross salary (applicable if gross < ₹21,000/month)
   */
  calculateESI(grossSalary: number): number {
    const esiThreshold = 21000;

    if (grossSalary >= esiThreshold) {
      return 0;
    }

    return Math.round(grossSalary * 0.0075);
  }

  /**
   * Calculate ESI - Employer Contribution
   * Employer contributes 3.25% of gross salary
   */
  calculateESIEmployer(grossSalary: number): number {
    const esiThreshold = 21000;

    if (grossSalary >= esiThreshold) {
      return 0;
    }

    return Math.round(grossSalary * 0.0325);
  }

  /**
   * Calculate Professional Tax (varies by state)
   * This is a simplified version - actual rates vary by state
   */
  calculateProfessionalTax(grossSalary: number): number {
    // Karnataka Professional Tax Slabs (example)
    if (grossSalary <= 15000) {
      return 0;
    } else if (grossSalary <= 20000) {
      return 150;
    } else {
      return 200;
    }
  }

  /**
   * Calculate TDS (Tax Deducted at Source)
   * Based on old tax regime (simplified)
   */
  async calculateTDS(
    annualIncome: number,
    financialYear: string,
  ): Promise<number> {
    // Fetch tax slabs for the financial year
    const taxSlabs = await this.prisma.taxSlab.findMany({
      where: {
        financialYear,
        isActive: true,
      },
      orderBy: {
        minIncome: 'asc',
      },
    });

    let tax = 0;
    let remainingIncome = annualIncome;

    for (const slab of taxSlabs) {
      const minIncome = slab.minIncome.toNumber();
      const maxIncome = slab.maxIncome?.toNumber() || Infinity;
      const taxRate = slab.taxRate.toNumber() / 100;

      if (remainingIncome <= 0) break;

      const taxableInThisSlab = Math.min(
        remainingIncome,
        maxIncome - minIncome,
      );

      if (taxableInThisSlab > 0) {
        tax += taxableInThisSlab * taxRate;
        remainingIncome -= taxableInThisSlab;
      }
    }

    // Monthly TDS
    return Math.round(tax / 12);
  }

  /**
   * Calculate Gratuity
   * Gratuity = (Last drawn salary × 15 × Number of years of service) / 26
   */
  calculateGratuity(
    lastDrawnSalary: number,
    yearsOfService: number,
  ): number {
    return Math.round((lastDrawnSalary * 15 * yearsOfService) / 26);
  }

  /**
   * Create or update tax slabs for a financial year
   */
  async createTaxSlab(data: {
    financialYear: string;
    minIncome: number;
    maxIncome?: number;
    taxRate: number;
  }) {
    return this.prisma.taxSlab.create({
      data: {
        financialYear: data.financialYear,
        minIncome: data.minIncome,
        maxIncome: data.maxIncome,
        taxRate: data.taxRate,
      },
    });
  }

  /**
   * Get tax slabs for a financial year
   */
  async getTaxSlabs(financialYear: string) {
    return this.prisma.taxSlab.findMany({
      where: {
        financialYear,
        isActive: true,
      },
      orderBy: {
        minIncome: 'asc',
      },
    });
  }

  /**
   * Calculate take-home salary
   */
  calculateTakeHome(
    grossSalary: number,
    basicSalary: number,
  ): {
    grossSalary: number;
    pf: number;
    esi: number;
    professionalTax: number;
    totalDeductions: number;
    netSalary: number;
  } {
    const pf = this.calculatePF(basicSalary);
    const esi = this.calculateESI(grossSalary);
    const professionalTax = this.calculateProfessionalTax(grossSalary);

    const totalDeductions = pf + esi + professionalTax;
    const netSalary = grossSalary - totalDeductions;

    return {
      grossSalary,
      pf,
      esi,
      professionalTax,
      totalDeductions,
      netSalary,
    };
  }
}
