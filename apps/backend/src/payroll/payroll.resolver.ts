import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { DocumentExportType } from '../common/document-export.types';
import {
  CreatePayrollPeriodInput,
  DeletePayrollPeriodInput,
  EmployeeCompensationType,
  MarkPayrollPeriodPaidInput,
  PayslipFilterInput,
  PayslipType,
  PayrollPeriodPreviewType,
  PayrollPeriodType,
  ProcessPayrollPeriodInput,
  UpsertEmployeeCompensationInput,
} from './payroll.types';
import { PayrollService } from './payroll.service';

@UseGuards(GqlAuthGuard)
@Resolver()
export class PayrollResolver {
  constructor(private readonly payrollService: PayrollService) {}

  @Query(() => [EmployeeCompensationType], { name: 'employeeCompensations' })
  async employeeCompensations(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.payrollService.employeeCompensations(currentUser);
  }

  @Query(() => [PayrollPeriodType], { name: 'payrollPeriods' })
  async payrollPeriods(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.payrollService.payrollPeriods(currentUser);
  }

  @Query(() => PayrollPeriodPreviewType, { name: 'payrollPeriodPreview' })
  async payrollPeriodPreview(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('payrollPeriodId', { type: () => String }) payrollPeriodId: string,
  ) {
    return this.payrollService.payrollPeriodPreview(currentUser, payrollPeriodId);
  }

  @Query(() => [PayslipType], { name: 'payslips' })
  async payslips(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('filter', { nullable: true }) filter?: PayslipFilterInput,
  ) {
    return this.payrollService.payslips(currentUser, filter);
  }

  @Query(() => DocumentExportType, { name: 'exportPayslipPdf' })
  async exportPayslipPdf(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('payslipId') payslipId: string,
  ) {
    return this.payrollService.exportPayslipPdf(currentUser, payslipId);
  }

  @Query(() => DocumentExportType, { name: 'exportPayrollPeriodPayslipsPdf' })
  async exportPayrollPeriodPayslipsPdf(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('payrollPeriodId', { type: () => String }) payrollPeriodId: string,
  ) {
    return this.payrollService.exportPayrollPeriodPayslipsPdf(currentUser, payrollPeriodId);
  }

  @Mutation(() => EmployeeCompensationType, { name: 'upsertEmployeeCompensation' })
  async upsertEmployeeCompensation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: UpsertEmployeeCompensationInput,
  ) {
    return this.payrollService.upsertEmployeeCompensation(currentUser, input);
  }

  @Mutation(() => PayrollPeriodType, { name: 'createPayrollPeriod' })
  async createPayrollPeriod(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreatePayrollPeriodInput,
  ) {
    return this.payrollService.createPayrollPeriod(currentUser, input);
  }

  @Mutation(() => PayrollPeriodType, { name: 'processPayrollPeriod' })
  async processPayrollPeriod(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ProcessPayrollPeriodInput,
  ) {
    return this.payrollService.processPayrollPeriod(currentUser, input);
  }

  @Mutation(() => PayrollPeriodType, { name: 'markPayrollPeriodPaid' })
  async markPayrollPeriodPaid(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: MarkPayrollPeriodPaidInput,
  ) {
    return this.payrollService.markPayrollPeriodPaid(currentUser, input);
  }

  @Mutation(() => Boolean, { name: 'deletePayrollPeriod' })
  async deletePayrollPeriod(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: DeletePayrollPeriodInput,
  ) {
    return this.payrollService.deletePayrollPeriod(currentUser, input);
  }
}
