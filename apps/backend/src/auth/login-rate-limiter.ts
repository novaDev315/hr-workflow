import { HttpException, HttpStatus } from '@nestjs/common';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS_PER_EMAIL = 5;
export const MAX_FAILED_ATTEMPTS_PER_IP = 20;
const MAX_TRACKED_KEYS = 10_000;

type Clock = () => number;

/**
 * In-memory sliding-window limiter for failed sign-ins, keyed by normalized
 * email and by client IP. Single-process only; adequate for one backend
 * instance. No external dependency.
 */
export class LoginRateLimiter {
  private readonly emailFailures = new Map<string, number[]>();
  private readonly ipFailures = new Map<string, number[]>();

  constructor(
    private readonly now: Clock = Date.now,
    private readonly windowMs = LOGIN_WINDOW_MS,
    private readonly maxPerEmail = MAX_FAILED_ATTEMPTS_PER_EMAIL,
    private readonly maxPerIp = MAX_FAILED_ATTEMPTS_PER_IP,
  ) {}

  /** Throws a 429 HttpException when either counter is exhausted. */
  assertAllowed(email: string, ip: string | null) {
    const wait = Math.max(
      this.waitMs(this.emailFailures, email, this.maxPerEmail),
      ip ? this.waitMs(this.ipFailures, ip, this.maxPerIp) : 0,
    );

    if (wait > 0) {
      const minutes = Math.max(1, Math.ceil(wait / 60_000));
      throw new HttpException(
        `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string, ip: string | null) {
    const timestamp = this.now();
    this.push(this.emailFailures, email, timestamp);
    if (ip) {
      this.push(this.ipFailures, ip, timestamp);
    }
  }

  clearEmail(email: string) {
    this.emailFailures.delete(email);
  }

  private recent(map: Map<string, number[]>, key: string) {
    const cutoff = this.now() - this.windowMs;
    const entries = (map.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (entries.length === 0) {
      map.delete(key);
    } else {
      map.set(key, entries);
    }

    return entries;
  }

  private waitMs(map: Map<string, number[]>, key: string, max: number) {
    const entries = this.recent(map, key);

    if (entries.length < max) {
      return 0;
    }

    // The limit lifts when the oldest counted failure leaves the window.
    const oldestCounted = entries[entries.length - max];
    return oldestCounted + this.windowMs - this.now();
  }

  private push(map: Map<string, number[]>, key: string, timestamp: number) {
    if (map.size >= MAX_TRACKED_KEYS && !map.has(key)) {
      for (const trackedKey of [...map.keys()]) {
        this.recent(map, trackedKey);
      }
      if (map.size >= MAX_TRACKED_KEYS) {
        // Drop the oldest tracked key rather than growing without bound.
        const oldest = map.keys().next().value;
        if (oldest !== undefined) {
          map.delete(oldest);
        }
      }
    }

    const entries = this.recent(map, key);
    entries.push(timestamp);
    map.set(key, entries);
  }
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

/**
 * Resolves the client IP. The first X-Forwarded-For hop is honored only when
 * TRUST_PROXY=true; otherwise the socket address is used.
 */
export function getClientIp(
  req: RequestLike | undefined,
  trustProxy: boolean = process.env.TRUST_PROXY?.trim().toLowerCase() === 'true',
): string | null {
  if (!req) {
    return null;
  }

  if (trustProxy) {
    const header = req.headers?.['x-forwarded-for'];
    const raw = Array.isArray(header) ? header[0] : header;
    const firstHop = raw?.split(',')[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  return req.ip ?? req.socket?.remoteAddress ?? null;
}
