import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveResolver } from './leave.resolver';
import { BalanceModule } from '../balance/balance.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [BalanceModule, CalendarModule],
  providers: [LeaveService, LeaveResolver],
  exports: [LeaveService],
})
export class LeaveModule {}
