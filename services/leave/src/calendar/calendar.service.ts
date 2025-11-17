import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getDay } from 'date-fns';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a date is a working day
   */
  async isWorkingDay(date: Date): Promise<boolean> {
    // Check if weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Check if holiday
    const calendar = await this.prisma.leaveCalendar.findUnique({
      where: { date },
    });

    if (calendar?.isHoliday) {
      return false;
    }

    return true;
  }

  /**
   * Add holiday to calendar
   */
  async addHoliday(data: {
    date: string;
    holidayName: string;
    description?: string;
  }) {
    const date = new Date(data.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = getDay(date);

    return this.prisma.leaveCalendar.upsert({
      where: { date },
      update: {
        isHoliday: true,
        holidayName: data.holidayName,
        description: data.description,
      },
      create: {
        date,
        year,
        month,
        day,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isHoliday: true,
        holidayName: data.holidayName,
        description: data.description,
      },
    });
  }

  /**
   * Get holidays for a year
   */
  async getHolidays(year: number) {
    return this.prisma.leaveCalendar.findMany({
      where: {
        year,
        isHoliday: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  /**
   * Remove holiday
   */
  async removeHoliday(date: string) {
    return this.prisma.leaveCalendar.update({
      where: { date: new Date(date) },
      data: {
        isHoliday: false,
        holidayName: null,
        description: null,
      },
    });
  }

  /**
   * Get working days count between two dates
   */
  async getWorkingDaysCount(startDate: Date, endDate: Date): Promise<number> {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (await this.isWorkingDay(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }
}
