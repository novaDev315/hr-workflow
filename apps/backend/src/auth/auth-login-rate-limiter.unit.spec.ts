import { HttpException } from '@nestjs/common';
import {
  getClientIp,
  LOGIN_WINDOW_MS,
  LoginRateLimiter,
} from './login-rate-limiter';

describe('LoginRateLimiter', () => {
  let now = 1_000_000;
  const clock = () => now;
  let limiter: LoginRateLimiter;

  beforeEach(() => {
    now = 1_000_000;
    limiter = new LoginRateLimiter(clock);
  });

  const fail = (email: string, ip: string | null, times: number) => {
    for (let i = 0; i < times; i += 1) {
      limiter.assertAllowed(email, ip);
      limiter.recordFailure(email, ip);
    }
  };

  it('allows up to five failures per email and blocks the sixth attempt', () => {
    fail('a@example.test', '10.0.0.1', 5);

    expect(() => limiter.assertAllowed('a@example.test', '10.0.0.1')).toThrow(
      HttpException,
    );
    expect(() => limiter.assertAllowed('a@example.test', '10.0.0.1')).toThrow(
      /Too many sign-in attempts\. Try again in 15 minutes\./,
    );
  });

  it('reports the remaining minutes and lifts the block after the window', () => {
    fail('a@example.test', null, 5);

    now += 10 * 60_000;
    expect(() => limiter.assertAllowed('a@example.test', null)).toThrow(
      'Too many sign-in attempts. Try again in 5 minutes.',
    );

    now += 5 * 60_000 + 1;
    expect(() => limiter.assertAllowed('a@example.test', null)).not.toThrow();
  });

  it('uses 429 and singular wording for the last minute', () => {
    fail('a@example.test', null, 5);
    now += LOGIN_WINDOW_MS - 30_000;

    try {
      limiter.assertAllowed('a@example.test', null);
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).toBe(
        'Too many sign-in attempts. Try again in 1 minute.',
      );
    }
  });

  it('clears the email counter on success but not the IP counter', () => {
    fail('a@example.test', '10.0.0.1', 4);
    limiter.clearEmail('a@example.test');

    fail('a@example.test', '10.0.0.1', 4);
    expect(() => limiter.assertAllowed('a@example.test', '10.0.0.1')).not.toThrow();
  });

  it('blocks an IP after 20 failures across different emails', () => {
    for (let i = 0; i < 20; i += 1) {
      limiter.assertAllowed(`user${i}@example.test`, '10.0.0.9');
      limiter.recordFailure(`user${i}@example.test`, '10.0.0.9');
    }

    expect(() =>
      limiter.assertAllowed('fresh@example.test', '10.0.0.9'),
    ).toThrow(/Too many sign-in attempts/);
    expect(() =>
      limiter.assertAllowed('fresh@example.test', '10.0.0.10'),
    ).not.toThrow();
  });

  it('forgets failures that fall out of the window', () => {
    fail('a@example.test', null, 4);
    now += LOGIN_WINDOW_MS + 1;
    fail('a@example.test', null, 4);

    expect(() => limiter.assertAllowed('a@example.test', null)).not.toThrow();
  });
});

describe('getClientIp', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' },
    ip: '10.0.0.2',
  };

  it('ignores X-Forwarded-For unless the proxy is trusted', () => {
    expect(getClientIp(req, false)).toBe('10.0.0.2');
  });

  it('uses only the first X-Forwarded-For hop when trusted', () => {
    expect(getClientIp(req, true)).toBe('203.0.113.7');
  });

  it('falls back to the socket address and tolerates a missing request', () => {
    expect(getClientIp({ socket: { remoteAddress: '::1' } }, true)).toBe('::1');
    expect(getClientIp(undefined, true)).toBeNull();
  });
});
