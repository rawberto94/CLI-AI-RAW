/**
 * Shared SSO utilities — RelayState signing, callback safety, attribute mapping,
 * domain allowlists, and group→role mapping.
 */

import crypto from 'crypto';
import { normalizeRole, getRoleLevel, type RbacRole } from '@/lib/permissions';

const RELAY_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const SSO_BRIDGE_COOKIE = 'contigo_sso_bridge';

export interface AttributeMapping {
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string;
}

export interface SsoRelayState {
  tenantId: string;
  providerId: string;
  callbackUrl: string;
  nonce: string;
  exp: number;
  /** protocol for multi-flow ACS routing */
  protocol?: 'saml' | 'oidc';
  /** PKCE code verifier for OIDC */
  codeVerifier?: string;
}

export interface NormalizedSsoProvider {
  id: string;
  name: string;
  protocol: 'saml' | 'oidc';
  entityId?: string;
  metadataUrl?: string;
  ssoUrl?: string;
  sloUrl?: string;
  certificate?: string;
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  attributeMapping: AttributeMapping;
  allowedDomains?: string[];
  /** Map IdP group name → app role */
  groupRoleMapping?: Record<string, string>;
  enabled?: boolean;
}

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SSO_RELAY_SECRET;
  if (!secret) {
    // Dev fallback — production must set NEXTAUTH_SECRET
    return 'dev-only-sso-relay-secret';
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', signingSecret()).update(data).digest('base64url');
}

/**
 * Only allow relative same-origin paths (open-redirect safe).
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('\\') || trimmed.includes('\n') || trimmed.includes('\r')) return fallback;
  // Block protocol-relative and scheme injection
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;
  return trimmed;
}

/**
 * Encode + HMAC-sign RelayState / OIDC state so ACS can trust tenantId/providerId.
 */
export function encodeSsoState(payload: Omit<SsoRelayState, 'nonce' | 'exp'> & { nonce?: string; exp?: number }): string {
  const body: SsoRelayState = {
    ...payload,
    callbackUrl: safeCallbackUrl(payload.callbackUrl),
    nonce: payload.nonce || crypto.randomBytes(16).toString('hex'),
    exp: payload.exp || Date.now() + RELAY_TTL_MS,
  };
  const encoded = b64url(JSON.stringify(body));
  const sig = hmac(encoded);
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode signed SSO state. Returns null if invalid/expired/tampered.
 */
export function decodeSsoState(raw: string | null | undefined): SsoRelayState | null {
  if (!raw || typeof raw !== 'string') return null;
  const parts = raw.split('.');
  if (parts.length !== 2) {
    // Legacy base64 JSON (unsigned) — reject in production, allow parse only for migration logs
    try {
      const legacy = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      if (process.env.NODE_ENV === 'production') {
        return null;
      }
      if (legacy?.providerId && legacy?.tenantId) {
        return {
          tenantId: String(legacy.tenantId),
          providerId: String(legacy.providerId),
          callbackUrl: safeCallbackUrl(legacy.callbackUrl),
          nonce: 'legacy',
          exp: Date.now() + 60_000,
          protocol: legacy.protocol,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  const [encoded, sig] = parts;
  const expected = hmac(encoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SsoRelayState;
    if (!body.tenantId || !body.providerId || !body.exp) return null;
    if (Date.now() > body.exp) return null;
    body.callbackUrl = safeCallbackUrl(body.callbackUrl);
    return body;
  } catch {
    return null;
  }
}

/**
 * Normalize provider config from admin storage (handles attributeMapping vs attributeMappings).
 */
export function normalizeSsoProvider(raw: Record<string, unknown> | null | undefined): NormalizedSsoProvider | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '');
  const protocol = raw.protocol === 'oidc' ? 'oidc' : raw.protocol === 'saml' ? 'saml' : null;
  if (!id || !protocol) return null;

  const mappingRaw =
    (raw.attributeMapping as AttributeMapping | undefined) ||
    (raw.attributeMappings as AttributeMapping | undefined) ||
    { email: 'email' };

  return {
    id,
    name: String(raw.name || id),
    protocol,
    entityId: raw.entityId ? String(raw.entityId) : undefined,
    metadataUrl: raw.metadataUrl ? String(raw.metadataUrl) : undefined,
    ssoUrl: raw.ssoUrl ? String(raw.ssoUrl) : undefined,
    sloUrl: raw.sloUrl ? String(raw.sloUrl) : undefined,
    certificate: raw.certificate ? String(raw.certificate) : undefined,
    clientId: raw.clientId ? String(raw.clientId) : undefined,
    clientSecret: raw.clientSecret ? String(raw.clientSecret) : undefined,
    issuer: raw.issuer ? String(raw.issuer) : undefined,
    attributeMapping: {
      email: mappingRaw.email || 'email',
      firstName: mappingRaw.firstName,
      lastName: mappingRaw.lastName,
      groups: mappingRaw.groups,
    },
    allowedDomains: Array.isArray(raw.allowedDomains)
      ? (raw.allowedDomains as string[]).map((d) => String(d).toLowerCase().replace(/^@/, ''))
      : undefined,
    groupRoleMapping:
      raw.groupRoleMapping && typeof raw.groupRoleMapping === 'object'
        ? (raw.groupRoleMapping as Record<string, string>)
        : undefined,
    enabled: raw.enabled !== false,
  };
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).toLowerCase();
}

/**
 * Returns true if email is allowed. Empty allowlist = allow all.
 */
export function isEmailDomainAllowed(email: string, allowedDomains?: string[] | null): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  const domain = emailDomain(email);
  if (!domain) return false;
  return allowedDomains.some((d) => {
    const normalized = d.toLowerCase().replace(/^@/, '');
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

/**
 * Global domain allowlist from env (comma-separated).
 */
export function globalSsoAllowedDomains(): string[] {
  const raw = process.env.SSO_ALLOWED_DOMAINS || '';
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

/**
 * Pick highest-privilege role from IdP groups via mapping.
 */
export function resolveRoleFromGroups(
  groups: string[] | undefined,
  groupRoleMapping?: Record<string, string> | null,
  fallback: string = 'member',
): string {
  if (!groups?.length || !groupRoleMapping || Object.keys(groupRoleMapping).length === 0) {
    return normalizeRole(fallback);
  }

  let best: RbacRole = normalizeRole(fallback);
  for (const group of groups) {
    const mapped = groupRoleMapping[group] ?? groupRoleMapping[group.toLowerCase()];
    if (!mapped) continue;
    const role = normalizeRole(mapped);
    if (getRoleLevel(role) > getRoleLevel(best)) {
      best = role;
    }
  }
  return best;
}

/** PKCE helpers for tenant OIDC */
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function isSecureCookieRequest(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}
