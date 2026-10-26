import {
  attendanceDateInTimeZone,
  resolveTimeZone,
  toIsoTimestamp,
} from './attendance-date';
import { describeNameForPdf, isLatin1Text } from '../common/simple-pdf';

describe('attendance date helpers', () => {
  it('dates a 22:30 UTC clock-in on the next day in Asia/Dubai', () => {
    expect(attendanceDateInTimeZone(new Date('2026-10-25T22:30:00Z'), 'Asia/Dubai')).toBe(
      '2026-10-26',
    );
  });

  it('dates a 02:00 Dubai clock-in on the Dubai day, not the previous UTC day', () => {
    // 02:00 Dubai = 22:00 UTC the day before
    expect(attendanceDateInTimeZone(new Date('2026-10-24T22:00:00Z'), 'Asia/Dubai')).toBe(
      '2026-10-25',
    );
  });

  it('switches day exactly at local midnight (20:00 UTC)', () => {
    expect(attendanceDateInTimeZone(new Date('2026-10-25T19:59:59Z'), 'Asia/Dubai')).toBe(
      '2026-10-25',
    );
    expect(attendanceDateInTimeZone(new Date('2026-10-25T20:00:00Z'), 'Asia/Dubai')).toBe(
      '2026-10-26',
    );
  });

  it('falls back to Asia/Dubai for missing or invalid zones', () => {
    expect(resolveTimeZone(undefined)).toBe('Asia/Dubai');
    expect(resolveTimeZone('Not/AZone')).toBe('Asia/Dubai');
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London');
    expect(attendanceDateInTimeZone(new Date('2026-10-25T22:30:00Z'), 'Not/AZone')).toBe(
      '2026-10-26',
    );
  });

  it('returns ISO-8601 timestamps', () => {
    expect(toIsoTimestamp(new Date('2026-10-25T18:46:18Z'))).toBe('2026-10-25T18:46:18.000Z');
    expect(toIsoTimestamp('2026-10-25 18:46:18+00')).toBe('2026-10-25T18:46:18.000Z');
    expect(toIsoTimestamp(null)).toBeNull();
  });
});

describe('pdf name fallback', () => {
  it('prints Latin-1 names and falls back for other scripts', () => {
    expect(isLatin1Text('José Müller')).toBe(true);
    expect(isLatin1Text('محمد علي')).toBe(false);
    expect(describeNameForPdf('Name', 'José Müller', 'EMP001')).toBe('Name: José Müller');
    expect(describeNameForPdf('Name', 'محمد علي', 'EMP002')).toBe(
      'Name: see employee record (EMP002)',
    );
  });
});
