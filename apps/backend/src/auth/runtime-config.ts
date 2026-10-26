import type { ValidationError } from '@nestjs/common';

/**
 * Startup-time configuration guards. These helpers are pure so they can be
 * unit-tested and reused by main.ts and the auth module.
 */

export const KNOWN_PLACEHOLDER_JWT_SECRETS = [
  'change_me_to_random_256_bit_secret',
  'replace_with_a_random_secret',
];

export const MIN_PRODUCTION_JWT_SECRET_LENGTH = 32;

export const DEFAULT_DEV_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:19006',
];

export function isProduction(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return nodeEnv === 'production';
}

export function resolveJwtSecret(
  rawSecret: string | undefined | null,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  const secret = rawSecret?.trim();

  if (!secret) {
    throw new Error(
      'JWT_SECRET is required. Set JWT_SECRET to a long random value before starting the backend.',
    );
  }

  if (isProduction(nodeEnv)) {
    if (secret.length < MIN_PRODUCTION_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_JWT_SECRET_LENGTH} characters in production.`,
      );
    }

    if (KNOWN_PLACEHOLDER_JWT_SECRETS.includes(secret)) {
      throw new Error(
        'JWT_SECRET is set to a known placeholder value. Generate a random secret for production.',
      );
    }
  }

  return secret;
}

export function resolveAllowedOrigins(
  raw: string | undefined | null,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length > 0) {
    return origins;
  }

  if (isProduction(nodeEnv)) {
    throw new Error(
      'ALLOWED_ORIGINS is required in production. Set it to a comma-separated list of allowed web origins.',
    );
  }

  return [...DEFAULT_DEV_ALLOWED_ORIGINS];
}

/** Bootstrap is always allowed outside production; in production it is opt-in. */
export function isBootstrapAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!isProduction(env.NODE_ENV)) {
    return true;
  }

  return env.BOOTSTRAP_ALLOWED?.trim().toLowerCase() === 'true';
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath: string,
  output: string[],
) {
  for (const error of errors) {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      const reasons = Object.values(error.constraints).map((message) => {
        const prefix = `${error.property} `;
        return message.startsWith(prefix) ? message.slice(prefix.length) : message;
      });
      output.push(`${fieldPath}: ${reasons.join(', ')}`);
    }

    if (error.children?.length) {
      flattenValidationErrors(error.children, fieldPath, output);
    }
  }
}

/** Readable one-line message listing every failing field and constraint. */
export function formatValidationErrors(errors: ValidationError[]): string {
  const lines: string[] = [];
  flattenValidationErrors(errors, '', lines);
  return lines.length > 0 ? lines.join('; ') : 'Validation failed';
}
