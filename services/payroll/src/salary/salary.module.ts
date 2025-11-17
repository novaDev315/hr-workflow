import { Module } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { SalaryResolver } from './salary.resolver';

@Module({
  providers: [SalaryService, SalaryResolver],
  exports: [SalaryService],
})
export class SalaryModule {}
