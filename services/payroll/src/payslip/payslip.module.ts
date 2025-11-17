import { Module } from '@nestjs/common';
import { PayslipService } from './payslip.service';
import { PayslipResolver } from './payslip.resolver';

@Module({
  providers: [PayslipService, PayslipResolver],
  exports: [PayslipService],
})
export class PayslipModule {}
