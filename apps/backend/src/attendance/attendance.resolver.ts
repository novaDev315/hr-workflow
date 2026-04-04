import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
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
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('filter', { nullable: true }) filter?: AttendanceFilterInput,
  ) {
    return this.attendanceService.findAll(currentUser, filter);
  }

  @Query(() => AttendanceRecordType, { name: 'attendanceRecord' })
  async attendanceRecord(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.attendanceService.findOne(currentUser, id);
  }

  @Mutation(() => AttendanceRecordType, { name: 'clockIn' })
  async clockIn(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ClockInInput,
  ) {
    return this.attendanceService.clockIn(currentUser, input);
  }

  @Mutation(() => AttendanceRecordType, { name: 'clockOut' })
  async clockOut(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: ClockOutInput,
  ) {
    return this.attendanceService.clockOut(currentUser, input);
  }
}
