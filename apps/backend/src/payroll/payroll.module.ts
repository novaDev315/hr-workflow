import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PayrollResolver } from './payroll.resolver';
import { PayrollService } from './payroll.service';

@Module({
  imports: [DatabaseModule],
  providers: [PayrollResolver, PayrollService],
})
export class PayrollModule {}
