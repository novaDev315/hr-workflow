export const REQUISITION_STATUSES = ['OPEN', 'ON_HOLD', 'FILLED', 'CLOSED'] as const;
export const OPEN_REQUISITION_STATUSES = ['OPEN', 'ON_HOLD'] as const;
export const EMPLOYMENT_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERNSHIP',
] as const;
export const REQUISITION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const APPLICATION_FORWARD_PATH = [
  'RECEIVED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'SELECTED',
  'OFFER_EXTENDED',
  'HIRED',
] as const;
export const APPLICATION_TERMINAL_STATUSES = ['REJECTED', 'WITHDRAWN'] as const;
export const APPLICATION_FINAL_STATUSES = [
  'HIRED',
  ...APPLICATION_TERMINAL_STATUSES,
] as const;
export const APPLICATION_STATUSES = [
  ...APPLICATION_FORWARD_PATH,
  ...APPLICATION_TERMINAL_STATUSES,
] as const;

/** Trims and upper-cases string inputs so enum checks accept "open" / " OPEN ". */
export function normalizeEnumInput({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}
