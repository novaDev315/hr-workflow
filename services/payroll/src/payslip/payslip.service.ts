import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

@Injectable()
export class PayslipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate payslip PDF for a payroll record
   */
  async generatePayslip(
    recordId: string,
    employeeDetails?: any,
  ): Promise<string> {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: {
        salaryStructure: true,
        payrollPeriod: true,
        adjustments: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'payslips');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `payslip_${record.employeeId}_${record.payrollPeriod.periodCode}.pdf`;
    const filepath = path.join(outputDir, filename);

    // Generate PDF
    await this.createPDF(filepath, record, employeeDetails);

    // Update record with payslip URL
    await this.prisma.payrollRecord.update({
      where: { id: recordId },
      data: {
        payslipUrl: filepath,
        payslipGeneratedAt: new Date(),
      },
    });

    return filepath;
  }

  /**
   * Create PDF document
   */
  private async createPDF(
    filepath: string,
    record: any,
    employeeDetails?: any,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      this.addHeader(doc, record, employeeDetails);

      // Employee Details
      this.addEmployeeDetails(doc, record, employeeDetails);

      // Earnings Section
      this.addEarningsSection(doc, record);

      // Deductions Section
      this.addDeductionsSection(doc, record);

      // Summary Section
      this.addSummarySection(doc, record);

      // Footer
      this.addFooter(doc);

      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Add header to PDF
   */
  private addHeader(doc: typeof PDFDocument, record: any, employeeDetails?: any) {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('HRFlow Pro', { align: 'center' })
      .fontSize(12)
      .font('Helvetica')
      .text('Salary Slip', { align: 'center' })
      .moveDown();

    const periodText = format(
      new Date(record.payrollPeriod.year, record.payrollPeriod.month - 1),
      'MMMM yyyy',
    );

    doc
      .fontSize(10)
      .text(`Pay Period: ${periodText}`, { align: 'center' })
      .moveDown(2);

    // Draw line
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown();
  }

  /**
   * Add employee details
   */
  private addEmployeeDetails(
    doc: typeof PDFDocument,
    record: any,
    employeeDetails?: any,
  ) {
    const y = doc.y;

    doc.fontSize(10).font('Helvetica-Bold');

    // Left column
    doc
      .text('Employee ID:', 50, y)
      .font('Helvetica')
      .text(record.employeeId, 150, y);

    doc.font('Helvetica-Bold');
    doc
      .text('Employee Name:', 50, y + 20)
      .font('Helvetica')
      .text(employeeDetails?.name || 'N/A', 150, y + 20);

    doc.font('Helvetica-Bold');
    doc
      .text('Department:', 50, y + 40)
      .font('Helvetica')
      .text(employeeDetails?.department || 'N/A', 150, y + 40);

    // Right column
    doc.font('Helvetica-Bold');
    doc
      .text('Pay Period:', 350, y)
      .font('Helvetica')
      .text(record.payrollPeriod.periodCode, 450, y);

    doc.font('Helvetica-Bold');
    doc
      .text('Working Days:', 350, y + 20)
      .font('Helvetica')
      .text(String(record.totalWorkingDays), 450, y + 20);

    doc.font('Helvetica-Bold');
    doc
      .text('Present Days:', 350, y + 40)
      .font('Helvetica')
      .text(record.presentDays.toString(), 450, y + 40);

    doc.moveDown(4);

    // Draw line
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown();
  }

  /**
   * Add earnings section
   */
  private addEarningsSection(doc: typeof PDFDocument, record: any) {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('EARNINGS', 50, doc.y)
      .moveDown();

    const earningsY = doc.y;

    doc.fontSize(10).font('Helvetica');

    const earnings = [
      { label: 'Basic Salary', amount: record.basicSalaryPaid },
      { label: 'HRA', amount: record.hraPaid },
      { label: 'Conveyance Allowance', amount: record.conveyancePaid },
      { label: 'Medical Allowance', amount: record.medicalPaid },
      { label: 'Special Allowance', amount: record.specialPaid },
      { label: 'Other Allowances', amount: record.otherAllowancesPaid },
    ];

    if (record.overtimeAmount.toNumber() > 0) {
      earnings.push({
        label: 'Overtime',
        amount: record.overtimeAmount,
      });
    }

    let y = earningsY;
    earnings.forEach((earning) => {
      doc.text(earning.label, 70, y);
      doc.text(`₹${earning.amount.toFixed(2)}`, 450, y, { align: 'right' });
      y += 20;
    });

    doc.moveDown();
  }

  /**
   * Add deductions section
   */
  private addDeductionsSection(doc: typeof PDFDocument, record: any) {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('DEDUCTIONS', 50, doc.y)
      .moveDown();

    const deductionsY = doc.y;

    doc.fontSize(10).font('Helvetica');

    const deductions = [
      { label: 'Provident Fund (PF)', amount: record.pfEmployee },
      { label: 'ESI', amount: record.esiEmployee },
      { label: 'Professional Tax', amount: record.professionalTax },
      { label: 'TDS', amount: record.tds },
      { label: 'Loan EMI', amount: record.loanDeduction },
      { label: 'Other Deductions', amount: record.otherDeductions },
    ];

    let y = deductionsY;
    deductions.forEach((deduction) => {
      if (deduction.amount.toNumber() > 0) {
        doc.text(deduction.label, 70, y);
        doc.text(`₹${deduction.amount.toFixed(2)}`, 450, y, { align: 'right' });
        y += 20;
      }
    });

    doc.moveDown(2);
  }

  /**
   * Add summary section
   */
  private addSummarySection(doc: typeof PDFDocument, record: any) {
    // Draw line
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold');

    const y = doc.y;

    doc.text('Gross Salary:', 50, y);
    doc.text(`₹${record.grossSalary.toFixed(2)}`, 450, y, { align: 'right' });

    doc.text('Total Deductions:', 50, y + 20);
    doc.text(`₹${record.totalDeductions.toFixed(2)}`, 450, y + 20, {
      align: 'right',
    });

    // Draw line
    doc.moveDown(2);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown();

    // Net Salary
    doc.fontSize(14).font('Helvetica-Bold');
    const netY = doc.y;

    doc.text('NET SALARY:', 50, netY);
    doc.text(`₹${record.netSalary.toFixed(2)}`, 450, netY, { align: 'right' });

    doc.moveDown(2);

    // Draw line
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();

    doc.moveDown();

    // Net salary in words
    doc
      .fontSize(10)
      .font('Helvetica-Oblique')
      .text(
        `Amount in words: ${this.numberToWords(record.netSalary.toNumber())} Rupees Only`,
        50,
        doc.y,
      );
  }

  /**
   * Add footer
   */
  private addFooter(doc: typeof PDFDocument) {
    doc.moveDown(3);

    doc
      .fontSize(8)
      .font('Helvetica-Oblique')
      .text(
        'This is a computer-generated document and does not require a signature.',
        50,
        doc.y,
        { align: 'center' },
      );

    doc.moveDown();
    doc.text(
      `Generated on: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`,
      50,
      doc.y,
      { align: 'center' },
    );
  }

  /**
   * Convert number to words (simplified)
   */
  private numberToWords(num: number): string {
    // This is a simplified version - in production, use a proper library
    const ones = [
      '',
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
    ];
    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];
    const teens = [
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];

    if (num === 0) return 'Zero';

    const integerPart = Math.floor(num);

    if (integerPart < 10) return ones[integerPart];
    if (integerPart < 20) return teens[integerPart - 10];
    if (integerPart < 100)
      return tens[Math.floor(integerPart / 10)] + ' ' + ones[integerPart % 10];

    // For larger numbers, this is simplified
    return `${integerPart}`;
  }

  /**
   * Bulk generate payslips for a period
   */
  async bulkGeneratePayslips(periodId: string): Promise<string[]> {
    const records = await this.prisma.payrollRecord.findMany({
      where: {
        payrollPeriodId: periodId,
        status: { in: ['CALCULATED', 'REVIEWED', 'APPROVED'] },
      },
    });

    const payslips: string[] = [];

    for (const record of records) {
      try {
        const payslip = await this.generatePayslip(record.id);
        payslips.push(payslip);
      } catch (error) {
        console.error(
          `Error generating payslip for record ${record.id}:`,
          error,
        );
      }
    }

    return payslips;
  }

  /**
   * Get payslip URL
   */
  async getPayslipUrl(recordId: string): Promise<string> {
    const record = await this.prisma.payrollRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (!record.payslipUrl) {
      throw new NotFoundException('Payslip not generated yet');
    }

    return record.payslipUrl;
  }
}
