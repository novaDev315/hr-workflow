import type { ValidationError } from '@nestjs/common';
import {
  formatValidationErrors,
  isBootstrapAllowed,
  resolveAllowedOrigins,
  resolveJwtSecret,
} from './runtime-config';

describe('resolveJwtSecret', () => {
  it('refuses a missing or blank secret in every environment', () => {
    expect(() => resolveJwtSecret(undefined, 'development')).toThrow(/JWT_SECRET is required/);
    expect(() => resolveJwtSecret('   ', 'test')).toThrow(/JWT_SECRET is required/);
  });

  it('accepts a short secret outside production', () => {
    expect(resolveJwtSecret('dev-secret', 'development')).toBe('dev-secret');
  });

  it('requires 32+ characters in production', () => {
    expect(() => resolveJwtSecret('short-secret', 'production')).toThrow(/at least 32/);
    expect(resolveJwtSecret('x'.repeat(32), 'production')).toBe('x'.repeat(32));
  });

  it.each(['change_me_to_random_256_bit_secret', 'replace_with_a_random_secret'])(
    'rejects the placeholder %s in production',
    (placeholder) => {
      expect(() => resolveJwtSecret(placeholder.padEnd(40, 'x'), 'production')).not.toThrow();
      expect(() => resolveJwtSecret(placeholder, 'production')).toThrow();
    },
  );

  it('rejects the 35-character public placeholder in production by name', () => {
    expect(() =>
      resolveJwtSecret('change_me_to_random_256_bit_secret', 'production'),
    ).toThrow(/placeholder/);
  });
});

describe('resolveAllowedOrigins', () => {
  it('trims and filters configured origins', () => {
    expect(
      resolveAllowedOrigins(' https://a.example , https://b.example,, ', 'production'),
    ).toEqual(['https://a.example', 'https://b.example']);
  });

  it('fails startup in production when unset', () => {
    expect(() => resolveAllowedOrigins(undefined, 'production')).toThrow(/ALLOWED_ORIGINS is required/);
    expect(() => resolveAllowedOrigins('  ,', 'production')).toThrow(/ALLOWED_ORIGINS is required/);
  });

  it('defaults to the local dev origins elsewhere', () => {
    expect(resolveAllowedOrigins(undefined, 'development')).toEqual([
      'http://localhost:5173',
      'http://localhost:8081',
      'http://localhost:19006',
    ]);
  });
});

describe('isBootstrapAllowed', () => {
  it('is always allowed outside production', () => {
    expect(isBootstrapAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(isBootstrapAllowed({})).toBe(true);
  });

  it('requires BOOTSTRAP_ALLOWED=true in production', () => {
    expect(isBootstrapAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(isBootstrapAllowed({ NODE_ENV: 'production', BOOTSTRAP_ALLOWED: 'false' })).toBe(false);
    expect(isBootstrapAllowed({ NODE_ENV: 'production', BOOTSTRAP_ALLOWED: 'true' })).toBe(true);
  });
});

describe('formatValidationErrors', () => {
  const error = (
    property: string,
    constraints?: Record<string, string>,
    children: ValidationError[] = [],
  ): ValidationError => ({ property, constraints, children });

  it('lists each failing field with its constraints', () => {
    expect(
      formatValidationErrors([
        error('code', { matches: 'must contain only capital letters, numbers and underscores' }),
        error('title', { isString: 'title must be a string', maxLength: 'title must be shorter' }),
      ]),
    ).toBe(
      'code: must contain only capital letters, numbers and underscores; title: must be a string, must be shorter',
    );
  });

  it('includes nested children with a dotted path', () => {
    expect(
      formatValidationErrors([
        error('input', undefined, [error('code', { matches: 'code is invalid' })]),
      ]),
    ).toBe('input.code: is invalid');
  });
});
