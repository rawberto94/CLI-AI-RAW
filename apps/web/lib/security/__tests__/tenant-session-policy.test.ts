import { describe, expect, it } from 'vitest';

import {
  calculateTenantSessionExpiry,
  getTenantSessionTimeoutHours,
  isTenantSessionExpired,
  normalizeTenantSessionTimeoutHours,
  parseTenantSessionExpiry,
  resolveTenantSessionActivityAt,
} from '../tenant-session-policy';

describe('tenant session policy helpers', () => {
  it('normalizes legacy minute-based session timeouts to hours', () => {
    expect(normalizeTenantSessionTimeoutHours(480)).toBe(8);
    expect(normalizeTenantSessionTimeoutHours(1440)).toBe(24);
  });

  it('uses the default timeout when settings are missing or invalid', () => {
    expect(getTenantSessionTimeoutHours(undefined)).toBe(8);
    expect(getTenantSessionTimeoutHours({ sessionTimeout: 'invalid' })).toBe(8);
  });

  it('calculates expiry from the issued-at timestamp', () => {
    const issuedAt = new Date('2026-05-06T10:00:00.000Z');

    expect(
      calculateTenantSessionExpiry({ sessionTimeout: 12 }, issuedAt).toISOString(),
    ).toBe('2026-05-06T22:00:00.000Z');
  });

  it('parses persisted expiry values and detects expiration', () => {
    const expiresAt = '2026-05-06T12:00:00.000Z';

    expect(parseTenantSessionExpiry(expiresAt)?.toISOString()).toBe(expiresAt);
    expect(isTenantSessionExpired(expiresAt, new Date('2026-05-06T12:00:01.000Z'))).toBe(true);
    expect(isTenantSessionExpired(expiresAt, new Date('2026-05-06T11:59:59.000Z'))).toBe(false);
  });

  it('falls back to the provided activity timestamp when no persisted activity exists', () => {
    const fallback = new Date('2026-05-06T09:30:00.000Z');

    expect(resolveTenantSessionActivityAt(undefined, fallback).toISOString()).toBe(
      fallback.toISOString(),
    );
    expect(resolveTenantSessionActivityAt('2026-05-06T10:00:00.000Z', fallback).toISOString()).toBe(
      '2026-05-06T10:00:00.000Z',
    );
  });
});