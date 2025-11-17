import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { addMonths } from 'date-fns';

@Injectable()
export class LoanService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply for loan
   */
  async applyLoan(data: {
    employeeId: string;
    loanType: string;
    loanAmount: number;
    interestRate: number;
    tenure: number;
    startDate: string;
  }) {
    // Calculate EMI
    const principal = data.loanAmount;
    const monthlyRate = data.interestRate / 100 / 12;
    const numberOfPayments = data.tenure;

    let emiAmount: number;
    if (data.interestRate === 0) {
      // Interest-free loan
      emiAmount = principal / numberOfPayments;
    } else {
      // EMI calculation: P × r × (1 + r)^n / ((1 + r)^n - 1)
      emiAmount =
        (principal *
          monthlyRate *
          Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }

    const startDate = new Date(data.startDate);
    const endDate = addMonths(startDate, data.tenure);

    return this.prisma.loan.create({
      data: {
        employeeId: data.employeeId,
        loanType: data.loanType as any,
        loanAmount: new Decimal(data.loanAmount),
        interestRate: new Decimal(data.interestRate),
        emiAmount: new Decimal(emiAmount),
        tenure: data.tenure,
        outstandingAmount: new Decimal(data.loanAmount),
        status: 'PENDING',
        startDate,
        endDate,
      },
    });
  }

  /**
   * Approve loan
   */
  async approveLoan(loanId: string, approvedBy: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.status !== 'PENDING') {
      throw new BadRequestException('Loan is not pending approval');
    }

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'ACTIVE',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Reject loan
   */
  async rejectLoan(loanId: string) {
    return this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'REJECTED' },
    });
  }

  /**
   * Process loan EMI payment
   */
  async processEMIPayment(loanId: string, paidAmount: number) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.status !== 'ACTIVE') {
      throw new BadRequestException('Loan is not active');
    }

    const newAmountPaid = loan.amountPaid.toNumber() + paidAmount;
    const newOutstanding = loan.loanAmount.toNumber() - newAmountPaid;

    const updateData: any = {
      amountPaid: new Decimal(newAmountPaid),
      outstandingAmount: new Decimal(newOutstanding),
    };

    // If loan is fully paid
    if (newOutstanding <= 0) {
      updateData.status = 'COMPLETED';
    }

    return this.prisma.loan.update({
      where: { id: loanId },
      data: updateData,
    });
  }

  /**
   * Get employee loans
   */
  async getEmployeeLoans(employeeId: string) {
    return this.prisma.loan.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get active loan for employee
   */
  async getActiveLoan(employeeId: string) {
    return this.prisma.loan.findFirst({
      where: {
        employeeId,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Cancel loan
   */
  async cancelLoan(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.status !== 'PENDING') {
      throw new BadRequestException(
        'Only pending loans can be cancelled',
      );
    }

    return this.prisma.loan.update({
      where: { id: loanId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Get loan details
   */
  async getLoanDetails(loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const remainingMonths = Math.ceil(
      loan.outstandingAmount.toNumber() / loan.emiAmount.toNumber(),
    );

    return {
      ...loan,
      remainingMonths,
      paidPercentage: (
        (loan.amountPaid.toNumber() / loan.loanAmount.toNumber()) *
        100
      ).toFixed(2),
    };
  }
}
