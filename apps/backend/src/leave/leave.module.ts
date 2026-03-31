import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LeaveResolver } from './leave.resolver';
import { LeaveService } from './leave.service';

@Module({
  imports: [PrismaModule],
  providers: [LeaveResolver, LeaveService],
})
export class LeaveModule {}
