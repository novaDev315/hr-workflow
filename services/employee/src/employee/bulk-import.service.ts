import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; field: string; error: string }>;
  createdEmployees: string[];
}

interface ExportOptions {
  format: 'xlsx' | 'csv';
  departmentId?: string;
  status?: string;
  includeFields?: string[];
}

@Injectable()
export class BulkImportService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ==================== BULK IMPORT ====================

  async importEmployees(fileBuffer: Buffer, createdBy: string): Promise<ImportResult> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      createdEmployees: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Excel rows start at 1, plus header

      try {
        // Validate required fields
        const validationErrors = this.validateEmployeeRow(row);
        if (validationErrors.length > 0) {
          result.failed++;
          validationErrors.forEach(error => {
            result.errors.push({ row: rowNumber, ...error });
          });
          continue;
        }

        // Check for duplicate email
        const existingEmail = await this.prisma.employee.findUnique({
          where: { email: row.email?.toLowerCase().trim() },
        });

        if (existingEmail) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            field: 'email',
            error: `Email ${row.email} already exists`,
          });
          continue;
        }

        // Get or create department
        let department = await this.prisma.department.findFirst({
          where: {
            OR: [
              { name: row.department },
              { code: row.department },
            ],
          },
        });

        if (!department) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            field: 'department',
            error: `Department ${row.department} not found`,
          });
          continue;
        }

        // Get or create designation
        let designation = await this.prisma.designation.findFirst({
          where: {
            OR: [
              { title: row.designation },
              { code: row.designation },
            ],
          },
        });

        if (!designation) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            field: 'designation',
            error: `Designation ${row.designation} not found`,
          });
          continue;
        }

        // Generate employee number
        const employeeNumber = await this.generateEmployeeNumber();

        // Create employee
        const employee = await this.prisma.employee.create({
          data: {
            employeeNumber,
            firstName: row.firstName?.trim(),
            lastName: row.lastName?.trim(),
            email: row.email?.toLowerCase().trim(),
            phone: row.phone?.toString().trim(),
            dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
            gender: this.parseGender(row.gender),
            maritalStatus: this.parseMaritalStatus(row.maritalStatus),
            nationality: row.nationality?.trim(),
            departmentId: department.id,
            designationId: designation.id,
            employmentType: this.parseEmploymentType(row.employmentType) || 'FULL_TIME',
            joinDate: row.joinDate ? new Date(row.joinDate) : new Date(),
            permanentAddress: row.permanentAddress?.trim(),
            currentAddress: row.currentAddress?.trim(),
            emergencyContactName: row.emergencyContactName?.trim(),
            emergencyContactPhone: row.emergencyContactPhone?.toString().trim(),
            emergencyContactRelation: row.emergencyContactRelation?.trim(),
            bankName: row.bankName?.trim(),
            accountNumber: row.accountNumber?.toString().trim(),
            ifscCode: row.ifscCode?.trim(),
            createdBy,
          },
        });

        result.success++;
        result.createdEmployees.push(employee.employeeNumber);
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          field: 'general',
          error: error.message,
        });
      }
    }

    this.eventEmitter.emit('employees.bulk.imported', {
      success: result.success,
      failed: result.failed,
      importedBy: createdBy,
    });

    return result;
  }

  private validateEmployeeRow(row: any): Array<{ field: string; error: string }> {
    const errors: Array<{ field: string; error: string }> = [];

    if (!row.firstName?.trim()) {
      errors.push({ field: 'firstName', error: 'First name is required' });
    }

    if (!row.lastName?.trim()) {
      errors.push({ field: 'lastName', error: 'Last name is required' });
    }

    if (!row.email?.trim()) {
      errors.push({ field: 'email', error: 'Email is required' });
    } else if (!this.isValidEmail(row.email)) {
      errors.push({ field: 'email', error: 'Invalid email format' });
    }

    if (!row.department?.trim()) {
      errors.push({ field: 'department', error: 'Department is required' });
    }

    if (!row.designation?.trim()) {
      errors.push({ field: 'designation', error: 'Designation is required' });
    }

    return errors;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private parseGender(gender: string): any {
    if (!gender) return undefined;
    const normalized = gender.toUpperCase().trim();
    const mapping: Record<string, string> = {
      'MALE': 'MALE',
      'M': 'MALE',
      'FEMALE': 'FEMALE',
      'F': 'FEMALE',
      'OTHER': 'OTHER',
      'O': 'OTHER',
    };
    return mapping[normalized];
  }

  private parseMaritalStatus(status: string): any {
    if (!status) return undefined;
    const normalized = status.toUpperCase().trim();
    const mapping: Record<string, string> = {
      'SINGLE': 'SINGLE',
      'S': 'SINGLE',
      'MARRIED': 'MARRIED',
      'M': 'MARRIED',
      'DIVORCED': 'DIVORCED',
      'D': 'DIVORCED',
      'WIDOWED': 'WIDOWED',
      'W': 'WIDOWED',
    };
    return mapping[normalized];
  }

  private parseEmploymentType(type: string): any {
    if (!type) return 'FULL_TIME';
    const normalized = type.toUpperCase().trim().replace(/[\s-]/g, '_');
    const mapping: Record<string, string> = {
      'FULL_TIME': 'FULL_TIME',
      'FULLTIME': 'FULL_TIME',
      'FT': 'FULL_TIME',
      'PART_TIME': 'PART_TIME',
      'PARTTIME': 'PART_TIME',
      'PT': 'PART_TIME',
      'CONTRACT': 'CONTRACT',
      'C': 'CONTRACT',
      'INTERNSHIP': 'INTERNSHIP',
      'INTERN': 'INTERNSHIP',
      'CONSULTANT': 'CONSULTANT',
    };
    return mapping[normalized] || 'FULL_TIME';
  }

  private async generateEmployeeNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EMP${year}`;

    const lastEmployee = await this.prisma.employee.findFirst({
      where: { employeeNumber: { startsWith: prefix } },
      orderBy: { employeeNumber: 'desc' },
    });

    let sequence = 1;
    if (lastEmployee) {
      const lastSequence = parseInt(lastEmployee.employeeNumber.slice(-4));
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  // ==================== BULK EXPORT ====================

  async exportEmployees(options: ExportOptions): Promise<Buffer> {
    const where: any = {};

    if (options.departmentId) {
      where.departmentId = options.departmentId;
    }

    if (options.status) {
      where.status = options.status;
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        department: true,
        designation: true,
        salaryStructures: {
          where: { isCurrent: true },
          take: 1,
        },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    const data = employees.map(emp => ({
      'Employee Number': emp.employeeNumber,
      'First Name': emp.firstName,
      'Last Name': emp.lastName,
      'Email': emp.email,
      'Phone': emp.phone || '',
      'Date of Birth': emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split('T')[0] : '',
      'Gender': emp.gender || '',
      'Marital Status': emp.maritalStatus || '',
      'Department': emp.department?.name || '',
      'Designation': emp.designation?.title || '',
      'Employment Type': emp.employmentType,
      'Join Date': new Date(emp.joinDate).toISOString().split('T')[0],
      'Status': emp.status,
      'Permanent Address': emp.permanentAddress || '',
      'Current Address': emp.currentAddress || '',
      'Emergency Contact Name': emp.emergencyContactName || '',
      'Emergency Contact Phone': emp.emergencyContactPhone || '',
      'Bank Name': emp.bankName || '',
      'Account Number': emp.accountNumber || '',
      'IFSC Code': emp.ifscCode || '',
      'Basic Salary': emp.salaryStructures[0]?.basicSalary?.toString() || '',
      'Gross Salary': emp.salaryStructures[0]?.grossSalary?.toString() || '',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Auto-width columns
    const maxWidths: Record<string, number> = {};
    data.forEach(row => {
      Object.entries(row).forEach(([key, value]) => {
        const len = Math.max(key.length, String(value).length);
        maxWidths[key] = Math.max(maxWidths[key] || 0, len);
      });
    });
    worksheet['!cols'] = Object.values(maxWidths).map(w => ({ wch: Math.min(w + 2, 50) }));

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

    if (options.format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return Buffer.from(csv, 'utf-8');
    }

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ==================== IMPORT TEMPLATE ====================

  async getImportTemplate(): Promise<Buffer> {
    const template = [
      {
        'firstName': 'John',
        'lastName': 'Doe',
        'email': 'john.doe@company.com',
        'phone': '9876543210',
        'dateOfBirth': '1990-01-15',
        'gender': 'MALE',
        'maritalStatus': 'SINGLE',
        'department': 'Engineering',
        'designation': 'Software Engineer',
        'employmentType': 'FULL_TIME',
        'joinDate': '2024-01-01',
        'permanentAddress': '123 Main St, City',
        'currentAddress': '456 Work St, City',
        'emergencyContactName': 'Jane Doe',
        'emergencyContactPhone': '9876543211',
        'emergencyContactRelation': 'Spouse',
        'bankName': 'State Bank',
        'accountNumber': '1234567890',
        'ifscCode': 'SBIN0001234',
      },
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(template);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employee Import Template');

    // Add instructions sheet
    const instructions = [
      { 'Field': 'firstName', 'Required': 'Yes', 'Description': 'Employee first name' },
      { 'Field': 'lastName', 'Required': 'Yes', 'Description': 'Employee last name' },
      { 'Field': 'email', 'Required': 'Yes', 'Description': 'Unique email address' },
      { 'Field': 'phone', 'Required': 'No', 'Description': 'Phone number' },
      { 'Field': 'dateOfBirth', 'Required': 'No', 'Description': 'Format: YYYY-MM-DD' },
      { 'Field': 'gender', 'Required': 'No', 'Description': 'MALE, FEMALE, OTHER' },
      { 'Field': 'maritalStatus', 'Required': 'No', 'Description': 'SINGLE, MARRIED, DIVORCED, WIDOWED' },
      { 'Field': 'department', 'Required': 'Yes', 'Description': 'Department name or code' },
      { 'Field': 'designation', 'Required': 'Yes', 'Description': 'Designation title or code' },
      { 'Field': 'employmentType', 'Required': 'No', 'Description': 'FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP' },
      { 'Field': 'joinDate', 'Required': 'No', 'Description': 'Format: YYYY-MM-DD (defaults to today)' },
    ];
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  // ==================== BULK LEAVE CREDIT ====================

  async bulkCreditLeave(data: {
    leaveType: string;
    creditDays: number;
    employeeIds?: string[];
    departmentId?: string;
    year: number;
    creditedBy: string;
  }): Promise<{ success: number; failed: number }> {
    let employees;

    if (data.employeeIds && data.employeeIds.length > 0) {
      employees = await this.prisma.employee.findMany({
        where: { id: { in: data.employeeIds }, status: 'ACTIVE' },
      });
    } else if (data.departmentId) {
      employees = await this.prisma.employee.findMany({
        where: { departmentId: data.departmentId, status: 'ACTIVE' },
      });
    } else {
      employees = await this.prisma.employee.findMany({
        where: { status: 'ACTIVE' },
      });
    }

    let success = 0;
    let failed = 0;

    // This would typically call the Leave Service
    // For now, emit an event that the Leave Service can handle
    for (const employee of employees) {
      try {
        this.eventEmitter.emit('leave.bulk.credit', {
          employeeId: employee.id,
          leaveType: data.leaveType,
          creditDays: data.creditDays,
          year: data.year,
          creditedBy: data.creditedBy,
        });
        success++;
      } catch (error) {
        failed++;
      }
    }

    return { success, failed };
  }
}
