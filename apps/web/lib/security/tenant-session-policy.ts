const DEFAULT_TENANT_SESSION_TIMEOUT_HOURS = 8;
const MIN_TENANT_SESSION_TIMEOUT_HOURS = 1;
const MAX_TENANT_SESSION_TIMEOUT_HOURS = 720;

type TenantSecuritySettingsLike = {
  sessionTimeout?: unknown;
} | null | undefined;

export {
  DEFAULT_TENANT_SESSION_TIMEOUT_HOURS,
  MIN_TENANT_SESSION_TIMEOUT_HOURS,
  MAX_TENANT_SESSION_TIMEOUT_HOURS,
};

export function normalizeTenantSessionTimeoutHours(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_TENANT_SESSION_TIMEOUT_HOURS;
  }

  const roundedValue = Math.round(value);
  const normalizedValue = roundedValue > 24 && roundedValue % 60 === 0
    ? Math.round(roundedValue / 60)
    : roundedValue;

  return Math.min(
    MAX_TENANT_SESSION_TIMEOUT_HOURS,
    Math.max(MIN_TENANT_SESSION_TIMEOUT_HOURS, normalizedValue),
  );
}

export function getTenantSessionTimeoutHours(settings: TenantSecuritySettingsLike): number {
  return normalizeTenantSessionTimeoutHours(settings?.sessionTimeout);
}

export function calculateTenantSessionExpiry(
  settings: TenantSecuritySettingsLike,
  issuedAt: Date = new Date(),
): Date {
  return new Date(
    issuedAt.getTime() + getTenantSessionTimeoutHours(settings) * 60 * 60 * 1000,
  );
}

export function parseTenantSessionExpiry(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedValue = new Date(value);
    return Number.isNaN(parsedValue.getTime()) ? null : parsedValue;
  }

  return null;
}

export function resolveTenantSessionActivityAt(
  value: unknown,
  fallback: Date = new Date(),
): Date {
  return parseTenantSessionExpiry(value) ?? fallback;
}

export function isTenantSessionExpired(value: unknown, now: Date = new Date()): boolean {
  const expiresAt = parseTenantSessionExpiry(value);
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}