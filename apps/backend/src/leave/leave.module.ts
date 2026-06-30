import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LeaveResolver } from './leave.resolver';
import { LeaveService } from './leave.service';

@Module({
  imports: [DatabaseModule],
  providers: [LeaveResolver, LeaveService],
})
export class LeaveModule {}
