import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PayrollResolver } from './payroll.resolver';
import { PayrollService } from './payroll.service';

@Module({
  imports: [PrismaModule],
  providers: [PayrollResolver, PayrollService],
})
export class PayrollModule {}
