import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  decodeSsoState,
  encodeSsoState,
  emailDomain,
  isEmailDomainAllowed,
  normalizeSsoProvider,
  resolveRoleFromGroups,
  safeCallbackUrl,
} from '../auth/sso-utils';

describe('safeCallbackUrl', () => {
  it('allows relative paths only', () => {
    expect(safeCallbackUrl('/dashboard')).toBe('/dashboard');
    expect(safeCallbackUrl('/contracts/abc')).toBe('/contracts/abc');
    expect(safeCallbackUrl('https://evil.com')).toBe('/dashboard');
    expect(safeCallbackUrl('//evil.com')).toBe('/dashboard');
    expect(safeCallbackUrl('\\evil')).toBe('/dashboard');
    expect(safeCallbackUrl(null)).toBe('/dashboard');
  });
});

describe('encode/decode SSO state', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips signed RelayState with tenantId', () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-for-sso-relay');
    const encoded = encodeSsoState({
      tenantId: 'tenant-1',
      providerId: 'prov-1',
      callbackUrl: '/inbox',
      protocol: 'saml',
    });
    const decoded = decodeSsoState(encoded);
    expect(decoded).toMatchObject({
      tenantId: 'tenant-1',
      providerId: 'prov-1',
      callbackUrl: '/inbox',
      protocol: 'saml',
    });
    expect(decoded?.nonce).toBeTruthy();
  });

  it('rejects tampered state', () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-for-sso-relay');
    const encoded = encodeSsoState({
      tenantId: 'tenant-1',
      providerId: 'prov-1',
      callbackUrl: '/dashboard',
    });
    const [body] = encoded.split('.');
    expect(decodeSsoState(`${body}.deadbeef`)).toBeNull();
  });

  it('rejects open redirect in callback after decode', () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-for-sso-relay');
    const encoded = encodeSsoState({
      tenantId: 't',
      providerId: 'p',
      callbackUrl: 'https://phish.example',
    });
    expect(decodeSsoState(encoded)?.callbackUrl).toBe('/dashboard');
  });
});

describe('domain allowlist', () => {
  it('extracts domain and enforces allowlist', () => {
    expect(emailDomain('User@Contoso.COM')).toBe('contoso.com');
    expect(isEmailDomainAllowed('a@contoso.com', [])).toBe(true);
    expect(isEmailDomainAllowed('a@contoso.com', ['contoso.com'])).toBe(true);
    expect(isEmailDomainAllowed('a@evil.com', ['contoso.com'])).toBe(false);
    expect(isEmailDomainAllowed('a@sub.contoso.com', ['contoso.com'])).toBe(true);
  });
});

describe('normalizeSsoProvider', () => {
  it('accepts attributeMappings alias and normalizes', () => {
    const p = normalizeSsoProvider({
      id: 'p1',
      name: 'Okta',
      protocol: 'saml',
      attributeMappings: { email: 'mail', firstName: 'given' },
      enabled: true,
    });
    expect(p?.attributeMapping.email).toBe('mail');
    expect(p?.attributeMapping.firstName).toBe('given');
  });

  it('accepts attributeMapping canonical field', () => {
    const p = normalizeSsoProvider({
      id: 'p2',
      protocol: 'oidc',
      attributeMapping: { email: 'email' },
      clientId: 'x',
      issuer: 'https://login.example.com',
    });
    expect(p?.protocol).toBe('oidc');
    expect(p?.attributeMapping.email).toBe('email');
  });
});

describe('resolveRoleFromGroups', () => {
  it('picks highest mapped role', () => {
    const role = resolveRoleFromGroups(
      ['Everyone', 'Contoso-Admins'],
      { 'Contoso-Admins': 'admin', Everyone: 'viewer' },
      'member',
    );
    expect(role).toBe('admin');
  });

  it('falls back when no groups match', () => {
    expect(resolveRoleFromGroups(['x'], { Admins: 'admin' }, 'member')).toBe('member');
  });
});
