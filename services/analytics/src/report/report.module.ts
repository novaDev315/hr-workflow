import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportResolver } from './report.resolver';

@Module({
  providers: [ReportService, ReportResolver],
  exports: [ReportService],
})
export class ReportModule {}
