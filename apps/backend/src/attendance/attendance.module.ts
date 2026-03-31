import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { AttendanceResolver } from './attendance.resolver';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [LocationModule],
  providers: [AttendanceResolver, AttendanceService],
})
export class AttendanceModule {}
