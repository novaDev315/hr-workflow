import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { eq, inArray } from 'drizzle-orm';

import { AuthenticatedUser } from '../common/current-user.decorator';
import { DatabaseModule } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import {
  departments,
  designations,
  employees,
  leaveRequests,
  leaveTypes,
  users,
} from '../database/drizzle/schema';
import { LeaveService } from '../leave/leave.service';

jest.setTimeout(60000);

const DAY = 24 * 60 * 60 * 1000;

function iso(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Monday of the given week offset counted from the first Monday on/after 1 March
 * of next year (keeps every test request inside one calendar year and inside the
 * allowed booking window).
 */
function marchMonday(weekOffset: number) {
  let time = Date.UTC(new Date().getUTCFullYear() + 1, 2, 1);
  while (new Date(time).getUTCDay() !== 1) {
    time += DAY;
  }
  return time + weekOffset * 7 * DAY;
}

describe('Leave business rules', () => {
  let moduleFixture: TestingModule;
  let database: DatabaseService;
  let leave: LeaveService;

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const departmentId = randomUUID();
  const designationId = randomUUID();
  const employeeId = randomUUID();
  const raceEmployeeId = randomUUID();
  const reviewerEmployeeId = randomUUID();
  const reviewerUserId = randomUUID();
  const outsiderUserId = randomUUID();
  const limitedTypeId = randomUUID();
  const roomyTypeId = randomUUID();

  const asAdmin = (userId: string): AuthenticatedUser => ({
    userId,
    email: `${userId}@example.test`,
    roles: ['ADMIN'],
  });
  const outsider = asAdmin(outsiderUserId);
  const selfReviewer = asAdmin(reviewerUserId);

  const insertEmployee = (id: string, label: string) =>
    database.drizzle.insert(employees).values({
      id,
      employeeNumber: `LV-${label}-${suffix}`,
      firstName: label,
      lastName: 'Leave',
      email: `${label.toLowerCase()}.${suffix}@example.test`,
      departmentId,
      designationId,
      joinDate: '2024-01-01',
    });

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
        DatabaseModule,
      ],
      providers: [LeaveService],
    }).compile();
    await moduleFixture.init();
    database = moduleFixture.get(DatabaseService);
    leave = moduleFixture.get(LeaveService);

    await database.drizzle.insert(departments).values({
      id: departmentId,
      name: `Leave Dept ${suffix}`,
      code: `LV_${suffix}`.slice(0, 24).toUpperCase(),
    });
    await database.drizzle.insert(designations).values({
      id: designationId,
      title: `Leave Designation ${suffix}`,
      code: `LVD_${suffix}`.slice(0, 24).toUpperCase(),
      departmentId,
    });
    await insertEmployee(employeeId, 'Alice');
    await insertEmployee(raceEmployeeId, 'Racer');
    await insertEmployee(reviewerEmployeeId, 'Reviewer');
    await database.drizzle.insert(users).values([
      {
        id: reviewerUserId,
        email: `reviewer.${suffix}@example.test`,
        employeeId: reviewerEmployeeId,
        passwordHash: 'hash',
        firstName: 'Reviewer',
        lastName: 'Leave',
      },
      {
        id: outsiderUserId,
        email: `outsider.${suffix}@example.test`,
        passwordHash: 'hash',
        firstName: 'Outsider',
        lastName: 'Leave',
      },
    ]);
    await database.drizzle.insert(leaveTypes).values([
      { id: limitedTypeId, code: `LIM_${suffix}`.slice(0, 20), name: `Limited ${suffix}`, defaultDays: 3 },
      { id: roomyTypeId, code: `ROOM_${suffix}`.slice(0, 20), name: `Roomy ${suffix}`, defaultDays: 200 },
    ]);
  });

  afterAll(async () => {
    if (database) {
      const employeeIds = [employeeId, raceEmployeeId, reviewerEmployeeId];
      await database.drizzle
        .delete(leaveRequests)
        .where(inArray(leaveRequests.employeeId, employeeIds));
      await database.drizzle.delete(users).where(inArray(users.id, [reviewerUserId, outsiderUserId]));
      await database.drizzle.delete(employees).where(inArray(employees.id, employeeIds));
      await database.drizzle
        .delete(leaveTypes)
        .where(inArray(leaveTypes.id, [limitedTypeId, roomyTypeId]));
      await database.drizzle.delete(designations).where(eq(designations.id, designationId));
      await database.drizzle.delete(departments).where(eq(departments.id, departmentId));
    }
    await moduleFixture?.close();
  });

  it('excludes weekends from totalDays and rejects weekend-only requests', async () => {
    const monday = marchMonday(0);
    const friday = monday + 4 * DAY;
    const nextMondayTime = monday + 7 * DAY;

    // Friday .. next Monday: Fri + Mon = 2 working days (Sat/Sun excluded)
    const created = await leave.requestLeave(outsider, {
      employeeId,
      leaveTypeId: roomyTypeId,
      startDate: iso(friday),
      endDate: iso(nextMondayTime),
      reason: 'Long weekend',
    });
    expect(created.totalDays).toBe(2);

    await expect(
      leave.requestLeave(outsider, {
        employeeId,
        leaveTypeId: roomyTypeId,
        startDate: iso(friday + 1 * DAY),
        endDate: iso(friday + 2 * DAY),
        reason: 'Weekend only',
      }),
    ).rejects.toThrow(/no working days/);
  });

  it('validates the allowed date window', async () => {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    await expect(
      leave.requestLeave(outsider, {
        employeeId,
        leaveTypeId: roomyTypeId,
        startDate: iso(today - 400 * DAY),
        endDate: iso(today - 399 * DAY),
        reason: 'Too old',
      }),
    ).rejects.toThrow(/more than one year in the past/);
    await expect(
      leave.requestLeave(outsider, {
        employeeId,
        leaveTypeId: roomyTypeId,
        startDate: iso(today + 800 * DAY),
        endDate: iso(today + 801 * DAY),
        reason: 'Too far',
      }),
    ).rejects.toThrow(/more than two years in the future/);
    await expect(
      leave.requestLeave(outsider, {
        employeeId,
        leaveTypeId: roomyTypeId,
        startDate: iso(today + 10 * DAY),
        endDate: iso(today + 5 * DAY),
        reason: 'Backwards',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces the balance, reserves pending days, and reports pendingDays', async () => {
    const monday = marchMonday(3);

    // 4 working days against a 3 day allowance
    await expect(
      leave.requestLeave(outsider, {
        employeeId,
        leaveTypeId: limitedTypeId,
        startDate: iso(monday),
        endDate: iso(monday + 3 * DAY),
        reason: 'Over balance',
      }),
    ).rejects.toThrow(/Insufficient/);

    const ok = await leave.requestLeave(outsider, {
      employeeId,
      leaveTypeId: limitedTypeId,
      startDate: iso(monday),
      endDate: iso(monday + 2 * DAY),
      reason: 'Uses entire allowance',
    });
    expect(ok.totalDays).toBe(3);

    // Pending request reserves the days: even a single extra day is rejected
    await expect(
      leave.requestLeave(outsider, {
        employeeId,
        leaveTypeId: limitedTypeId,
        startDate: iso(monday + 7 * DAY),
        endDate: iso(monday + 7 * DAY),
        reason: 'No balance left',
      }),
    ).rejects.toThrow(/Insufficient/);

    await database.drizzle
      .update(leaveRequests)
      .set({ status: 'REJECTED' })
      .where(eq(leaveRequests.id, ok.id));
  });

  it('reports pendingDays for the current year', async () => {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    let start = Date.UTC(now.getUTCFullYear(), 0, 5);
    while (new Date(start).getUTCDay() !== 1) {
      start += DAY;
    }
    expect(start).toBeLessThan(today + 365 * DAY);
    const created = await database.drizzle
      .insert(leaveRequests)
      .values({
        id: randomUUID(),
        employeeId: reviewerEmployeeId,
        leaveTypeId: limitedTypeId,
        startDate: iso(start),
        endDate: iso(start + DAY),
        totalDays: 2,
        reason: 'pending balance proof',
        status: 'PENDING',
      })
      .returning({ id: leaveRequests.id });
    expect(created).toHaveLength(1);

    const balances = await leave.leaveBalances(outsider, reviewerEmployeeId);
    const limited = balances.find((balance) => balance.leaveTypeId === limitedTypeId);
    expect(limited?.pendingDays).toBe(2);
    expect(limited?.usedDays).toBe(0);
    expect(limited?.availableDays).toBe(1);
  });

  it('rejects a second review of the same request and re-checks the balance on approval', async () => {
    const monday = marchMonday(6);
    const mk = async (offsetWeeks: number) => {
      const id = randomUUID();
      await database.drizzle.insert(leaveRequests).values({
        id,
        employeeId: raceEmployeeId,
        leaveTypeId: limitedTypeId,
        startDate: iso(monday + offsetWeeks * 7 * DAY),
        endDate: iso(monday + offsetWeeks * 7 * DAY + DAY),
        totalDays: 2,
        reason: 'legacy pending request',
        status: 'PENDING',
      });
      return id;
    };
    // Two legacy pending requests of 2 days each against a 3 day allowance
    const first = await mk(0);
    const second = await mk(1);

    const reviewed = await leave.reviewLeaveRequest(outsider, {
      requestId: first,
      status: 'APPROVED',
    });
    expect(reviewed.status).toBe('APPROVED');

    await expect(
      leave.reviewLeaveRequest(outsider, { requestId: first, status: 'APPROVED' }),
    ).rejects.toThrow(ConflictException);
    await expect(
      leave.reviewLeaveRequest(outsider, { requestId: first, status: 'REJECTED' }),
    ).rejects.toThrow('This request was already reviewed');

    // Approving the second would reach 4 > 3 approved days: rejected and rolled back
    await expect(
      leave.reviewLeaveRequest(outsider, { requestId: second, status: 'APPROVED' }),
    ).rejects.toThrow(/Insufficient/);
    const [stillPending] = await database.drizzle
      .select({ status: leaveRequests.status })
      .from(leaveRequests)
      .where(eq(leaveRequests.id, second));
    expect(stillPending.status).toBe('PENDING');
  });

  it('lets only one of two concurrent reviews win', async () => {
    const monday = marchMonday(9);
    const id = randomUUID();
    await database.drizzle.insert(leaveRequests).values({
      id,
      employeeId: raceEmployeeId,
      leaveTypeId: roomyTypeId,
      startDate: iso(monday),
      endDate: iso(monday),
      totalDays: 1,
      reason: 'concurrent review',
      status: 'PENDING',
    });

    const results = await Promise.allSettled([
      leave.reviewLeaveRequest(outsider, { requestId: id, status: 'APPROVED' }),
      leave.reviewLeaveRequest(outsider, { requestId: id, status: 'REJECTED' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
  });

  it('forbids reviewing your own leave request', async () => {
    const monday = marchMonday(10);
    const request = await leave.requestLeave(outsider, {
      employeeId: reviewerEmployeeId,
      leaveTypeId: roomyTypeId,
      startDate: iso(monday),
      endDate: iso(monday),
      reason: 'Own request',
    });

    await expect(
      leave.reviewLeaveRequest(selfReviewer, { requestId: request.id, status: 'APPROVED' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      leave.reviewLeaveRequest(selfReviewer, { requestId: request.id, status: 'APPROVED' }),
    ).rejects.toThrow('You cannot review your own leave request');

    // Someone else can still review it
    const reviewed = await leave.reviewLeaveRequest(outsider, {
      requestId: request.id,
      status: 'APPROVED',
    });
    expect(reviewed.status).toBe('APPROVED');
  });

  it('allows exactly one of two concurrent overlapping requests', async () => {
    const monday = marchMonday(12);
    const attempt = (reason: string) =>
      leave.requestLeave(outsider, {
        employeeId: raceEmployeeId,
        leaveTypeId: roomyTypeId,
        startDate: iso(monday),
        endDate: iso(monday + 2 * DAY),
        reason,
      });

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) => attempt(`race ${index}`)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(rejected).toHaveLength(5);
    for (const failure of rejected) {
      expect(failure.reason).toBeInstanceOf(ConflictException);
    }

    const stored = await database.drizzle
      .select({ id: leaveRequests.id })
      .from(leaveRequests)
      .where(eq(leaveRequests.employeeId, raceEmployeeId));
    expect(stored.filter((row) => row.id).length).toBeGreaterThanOrEqual(1);
  });
});
