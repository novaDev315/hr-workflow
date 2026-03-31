import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { AttendanceService } from './attendance.service';
import {
  AttendanceFilterInput,
  AttendanceRecordType,
  ClockInInput,
  ClockOutInput,
} from './attendance.types';

@UseGuards(GqlAuthGuard)
@Resolver(() => AttendanceRecordType)
export class AttendanceResolver {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Query(() => [AttendanceRecordType], { name: 'attendanceRecords' })
  async attendanceRecords(
    @Args('filter', { nullable: true }) filter?: AttendanceFilterInput,
  ) {
    return this.attendanceService.findAll(filter);
  }

  @Query(() => AttendanceRecordType, { name: 'attendanceRecord' })
  async attendanceRecord(@Args('id', { type: () => ID }) id: string) {
    return this.attendanceService.findOne(id);
  }

  @Mutation(() => AttendanceRecordType, { name: 'clockIn' })
  async clockIn(@Args('input') input: ClockInInput) {
    return this.attendanceService.clockIn(input);
  }

  @Mutation(() => AttendanceRecordType, { name: 'clockOut' })
  async clockOut(@Args('input') input: ClockOutInput) {
    return this.attendanceService.clockOut(input);
  }
}
