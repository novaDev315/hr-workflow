import { Module } from '@nestjs/common';
import { ShiftService } from './shift.service';
import { ShiftResolver } from './shift.resolver';
import { PrismaService } from '../prisma.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [ShiftService, ShiftResolver, PrismaService],
  exports: [ShiftService],
})
export class ShiftModule {}
