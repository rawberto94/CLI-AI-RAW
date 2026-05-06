import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createGoogleDriveOAuthState,
  validateGoogleDriveOAuthState,
} from '../google-drive';

describe('Google Drive OAuth state helpers', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('validates a state for the same tenant and user', () => {
    const state = createGoogleDriveOAuthState('tenant-1', 'user-1');

    expect(validateGoogleDriveOAuthState(state, 'tenant-1', 'user-1')).toBe(true);
  });

  it('rejects a state for a different tenant or user', () => {
    const state = createGoogleDriveOAuthState('tenant-1', 'user-1');

    expect(validateGoogleDriveOAuthState(state, 'tenant-2', 'user-1')).toBe(false);
    expect(validateGoogleDriveOAuthState(state, 'tenant-1', 'user-2')).toBe(false);
  });

  it('rejects a tampered state', () => {
    const state = createGoogleDriveOAuthState('tenant-1', 'user-1');
    const tampered = `${state.slice(0, -1)}${state.endsWith('A') ? 'B' : 'A'}`;

    expect(validateGoogleDriveOAuthState(tampered, 'tenant-1', 'user-1')).toBe(false);
  });

  it('rejects an expired state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const state = createGoogleDriveOAuthState('tenant-1', 'user-1');

    vi.setSystemTime(new Date('2026-01-01T00:11:00.000Z'));
    expect(validateGoogleDriveOAuthState(state, 'tenant-1', 'user-1')).toBe(false);
  });
});