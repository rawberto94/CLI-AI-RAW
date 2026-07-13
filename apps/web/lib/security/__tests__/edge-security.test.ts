import { describe, expect, it } from 'vitest';

import {
  applySessionIdentityHeaders,
  buildContentSecurityPolicy,
  isAuthRequired,
  stripIdentityHeaders,
} from '../edge-security';

describe('edge-security', () => {
  it('strips forged identity headers before session injection', () => {
    const headers = new Headers({
      'x-tenant-id': 'forged-tenant',
      'x-user-id': 'forged-user',
      'x-user-role': 'admin',
      'x-user-session-id': 'forged-session',
    });

    applySessionIdentityHeaders(headers, {
      tenantId: 'real-tenant',
      id: 'real-user',
      role: 'viewer',
      userSessionId: 'real-session',
    });

    expect(headers.get('x-tenant-id')).toBe('real-tenant');
    expect(headers.get('x-user-id')).toBe('real-user');
    expect(headers.get('x-user-role')).toBe('viewer');
    expect(headers.get('x-user-session-id')).toBe('real-session');
  });

  it('removes identity headers when session has no tenant', () => {
    const headers = new Headers({
      'x-tenant-id': 'forged-tenant',
      'x-user-id': 'forged-user',
    });

    applySessionIdentityHeaders(headers, null);
    expect(headers.get('x-tenant-id')).toBeNull();
    expect(headers.get('x-user-id')).toBeNull();
  });

  it('stripIdentityHeaders clears all identity headers', () => {
    const headers = new Headers({
      'x-tenant-id': 'a',
      'x-user-id': 'b',
      'x-user-role': 'c',
      'x-user-session-id': 'd',
    });
    stripIdentityHeaders(headers);
    expect(headers.get('x-tenant-id')).toBeNull();
    expect(headers.get('x-user-id')).toBeNull();
    expect(headers.get('x-user-role')).toBeNull();
    expect(headers.get('x-user-session-id')).toBeNull();
  });

  it('requires auth in production unless explicitly disabled', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalRequireAuth = process.env.REQUIRE_AUTH;

    process.env.NODE_ENV = 'production';
    delete process.env.REQUIRE_AUTH;
    expect(isAuthRequired()).toBe(true);

    process.env.REQUIRE_AUTH = 'false';
    expect(isAuthRequired()).toBe(false);

    process.env.NODE_ENV = 'development';
    delete process.env.REQUIRE_AUTH;
    expect(isAuthRequired()).toBe(false);

    process.env.REQUIRE_AUTH = 'true';
    expect(isAuthRequired()).toBe(true);

    process.env.NODE_ENV = originalNodeEnv;
    process.env.REQUIRE_AUTH = originalRequireAuth;
  });

  it('builds production CSP without unsafe-inline scripts', () => {
    const csp = buildContentSecurityPolicy('abc123', false);
    const scriptSrc = csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
  });
});