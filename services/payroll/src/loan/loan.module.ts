import { Module } from '@nestjs/common';
import { LoanService } from './loan.service';
import { LoanResolver } from './loan.resolver';

@Module({
  providers: [LoanService, LoanResolver],
  exports: [LoanService],
})
export class LoanModule {}
