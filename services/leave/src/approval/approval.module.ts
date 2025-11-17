import { Module } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApprovalResolver } from './approval.resolver';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [BalanceModule],
  providers: [ApprovalService, ApprovalResolver],
  exports: [ApprovalService],
})
export class ApprovalModule {}
