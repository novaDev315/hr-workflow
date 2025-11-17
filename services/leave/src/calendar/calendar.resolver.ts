import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { CalendarService } from './calendar.service';

@Resolver('LeaveCalendar')
export class CalendarResolver {
  constructor(private readonly calendarService: CalendarService) {}

  @Mutation()
  async addHoliday(@Args('input') input: any) {
    return this.calendarService.addHoliday(input);
  }

  @Query()
  async holidays(@Args('year', { type: () => Number }) year: number) {
    return this.calendarService.getHolidays(year);
  }

  @Mutation()
  async removeHoliday(@Args('date') date: string) {
    return this.calendarService.removeHoliday(date);
  }

  @Query()
  async workingDaysCount(
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    return this.calendarService.getWorkingDaysCount(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Query()
  async isWorkingDay(@Args('date') date: string) {
    return this.calendarService.isWorkingDay(new Date(date));
  }
}
