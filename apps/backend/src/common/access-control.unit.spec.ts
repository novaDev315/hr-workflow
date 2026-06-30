import { ForbiddenException } from '@nestjs/common';
import {
  assertAccountManagerAccess,
  assertAdminPanelAccess,
  hasAccountManagerAccess,
  hasAdminPanelAccess,
  hasGlobalAdminAccess,
  hasManagerAccess,
  hasSupervisorAccess,
} from './access-control';

describe('access-control role helpers', () => {
  it('identifies admin panel and account-management capabilities', () => {
    expect(hasAdminPanelAccess(['ADMIN'])).toBe(true);
    expect(hasAdminPanelAccess(['HR_ADMIN'])).toBe(true);
    expect(hasAdminPanelAccess(['MANAGER'])).toBe(true);
    expect(hasAdminPanelAccess(['SUPERVISOR'])).toBe(true);
    expect(hasAdminPanelAccess(['EMPLOYEE'])).toBe(false);

    expect(hasAccountManagerAccess(['ADMIN'])).toBe(true);
    expect(hasAccountManagerAccess(['HR_ADMIN'])).toBe(true);
    expect(hasAccountManagerAccess(['MANAGER'])).toBe(false);
    expect(hasAccountManagerAccess(['SUPERVISOR'])).toBe(false);
    expect(hasAccountManagerAccess(['EMPLOYEE'])).toBe(false);
  });

  it('keeps narrower role predicates distinct', () => {
    expect(hasGlobalAdminAccess(['ADMIN'])).toBe(true);
    expect(hasGlobalAdminAccess(['HR_ADMIN'])).toBe(true);
    expect(hasGlobalAdminAccess(['MANAGER'])).toBe(false);
    expect(hasManagerAccess(['MANAGER'])).toBe(true);
    expect(hasManagerAccess(['SUPERVISOR'])).toBe(false);
    expect(hasSupervisorAccess(['SUPERVISOR'])).toBe(true);
    expect(hasSupervisorAccess(['EMPLOYEE'])).toBe(false);
  });

  it('throws forbidden errors for disallowed access classes', () => {
    expect(() => assertAdminPanelAccess(['EMPLOYEE'])).toThrow(ForbiddenException);
    expect(() => assertAccountManagerAccess(['MANAGER'])).toThrow(ForbiddenException);
    expect(() => assertAdminPanelAccess(['SUPERVISOR'])).not.toThrow();
    expect(() => assertAccountManagerAccess(['HR_ADMIN'])).not.toThrow();
  });
});
