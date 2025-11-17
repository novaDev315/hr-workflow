import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalanceResolver } from './balance.resolver';

@Module({
  providers: [BalanceService, BalanceResolver],
  exports: [BalanceService],
})
export class BalanceModule {}
