import { countWorkingDays, parseDateOnly, workingDaysByYear } from './leave-days';

describe('countWorkingDays', () => {
  it('counts a single weekday as one day', () => {
    // 2026-10-26 is a Monday
    expect(countWorkingDays('2026-10-26', '2026-10-26')).toBe(1);
  });

  it('counts a single Saturday or Sunday as zero', () => {
    expect(countWorkingDays('2026-10-24', '2026-10-24')).toBe(0);
    expect(countWorkingDays('2026-10-25', '2026-10-25')).toBe(0);
    expect(countWorkingDays('2026-10-24', '2026-10-25')).toBe(0);
  });

  it('excludes weekends inside a range (inclusive)', () => {
    // Mon 2026-10-26 .. Mon 2026-11-02 = Mon-Fri (5) + Mon (1)
    expect(countWorkingDays('2026-10-26', '2026-11-02')).toBe(6);
    // Fri .. Mon spans a weekend: Fri + Mon
    expect(countWorkingDays('2026-10-23', '2026-10-26')).toBe(2);
  });

  it('matches the audited 20 Dec - 2 Jan case (14 calendar days)', () => {
    // 2026-12-20 is a Sunday; 2027-01-02 is a Saturday: 10 working days
    expect(countWorkingDays('2026-12-20', '2027-01-02')).toBe(10);
  });

  it('returns zero when end is before start', () => {
    expect(countWorkingDays('2026-10-30', '2026-10-26')).toBe(0);
  });

  it('handles leap-day boundaries', () => {
    // 2028-02-29 is a Tuesday
    expect(countWorkingDays('2028-02-28', '2028-03-01')).toBe(3);
  });

  it('rejects malformed dates', () => {
    expect(() => countWorkingDays('2026-13-01', '2026-13-02')).toThrow(RangeError);
    expect(() => countWorkingDays('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(() => countWorkingDays('26-10-26', '2026-10-27')).toThrow(RangeError);
  });
});

describe('workingDaysByYear', () => {
  it('splits a cross-year request by calendar year', () => {
    const byYear = workingDaysByYear('2026-12-20', '2027-01-02');
    // Dec 21-25 (5) + Dec 28-31 (4) = 9 in 2026; Jan 1 (Fri) = 1 in 2027
    expect(byYear.get(2026)).toBe(9);
    expect(byYear.get(2027)).toBe(1);
    expect(byYear.size).toBe(2);
  });

  it('omits years with no working days', () => {
    // Sat 2026-12-26 .. Sun 2027-01-03... only weekend days in 2026
    const byYear = workingDaysByYear('2026-12-26', '2026-12-27');
    expect(byYear.size).toBe(0);
  });

  it('single day yields a single-year entry', () => {
    const byYear = workingDaysByYear('2026-10-26', '2026-10-26');
    expect([...byYear.entries()]).toEqual([[2026, 1]]);
  });
});

describe('parseDateOnly', () => {
  it('parses to UTC midnight', () => {
    expect(new Date(parseDateOnly('2026-10-26')).toISOString()).toBe(
      '2026-10-26T00:00:00.000Z',
    );
  });
});
