import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PayrollService } from './payroll.service';
import { PayrollResolver } from './payroll.resolver';
import { TaxModule } from '../tax/tax.module';

@Module({
  imports: [HttpModule, TaxModule],
  providers: [PayrollService, PayrollResolver],
  exports: [PayrollService],
})
export class PayrollModule {}
