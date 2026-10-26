import {
  formatAmount,
  formatDateRange,
  formatGeneratedAt,
  formatIsoDate,
  formatMoney,
  formatPeriodMonth,
  humanizeStatus,
  pluralize,
  resolveTimeZone,
} from './document-format';

describe('document-format', () => {
  it('formats period months and date ranges', () => {
    expect(formatPeriodMonth('2026-08')).toBe('August 2026');
    expect(formatPeriodMonth('bogus')).toBe('bogus');
    expect(formatIsoDate('2026-08-01')).toBe('1 Aug 2026');
    expect(formatDateRange('2026-08-01', '2026-08-31')).toBe('1 – 31 Aug 2026');
    expect(formatDateRange('2026-08-01', '2026-08-31', '-')).toBe('1 - 31 Aug 2026');
    expect(formatDateRange('2026-08-10', '2026-08-10')).toBe('10 Aug 2026');
    expect(formatDateRange('2026-08-15', '2026-09-14')).toBe('15 Aug – 14 Sep 2026');
    expect(formatDateRange('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 – 2 Jan 2027');
  });

  it('humanizes statuses', () => {
    expect(humanizeStatus('PAID')).toBe('Paid');
    expect(humanizeStatus('PENDING_APPROVAL')).toBe('Pending approval');
    expect(humanizeStatus('')).toBe('');
  });

  it('formats money with thousands separators', () => {
    expect(formatAmount(4500)).toBe('4,500.00');
    expect(formatAmount(1234567.891)).toBe('1,234,567.89');
    expect(formatAmount(0)).toBe('0.00');
    expect(formatMoney(4500, 'AED')).toBe('AED 4,500.00');
    expect(formatMoney(12.5)).toBe('12.50');
  });

  it('formats the generated timestamp in the company timezone with UTC fallback', () => {
    const at = new Date('2026-10-26T15:28:00Z');
    expect(formatGeneratedAt(at, 'Asia/Dubai')).toBe('26 Oct 2026, 19:28 (Asia/Dubai)');
    expect(formatGeneratedAt(at, null)).toBe('26 Oct 2026, 15:28 (UTC)');
    expect(formatGeneratedAt(at, 'Not/AZone')).toBe('26 Oct 2026, 15:28 (UTC)');
    expect(resolveTimeZone('  ')).toBe('UTC');
  });

  it('uses real plurals', () => {
    expect(pluralize(1, 'employee')).toBe('1 employee');
    expect(pluralize(6, 'employee')).toBe('6 employees');
    expect(pluralize(0, 'designation')).toBe('0 designations');
  });
});
