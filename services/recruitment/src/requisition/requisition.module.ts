import { Module } from '@nestjs/common';
import { RequisitionService } from './requisition.service';
import { RequisitionResolver } from './requisition.resolver';

@Module({
  providers: [RequisitionService, RequisitionResolver],
  exports: [RequisitionService],
})
export class RequisitionModule {}
