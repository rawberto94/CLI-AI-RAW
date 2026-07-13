/**
 * Edge-runtime security helpers (middleware-safe — no Node.js imports).
 */

export const IDENTITY_HEADERS = [
  'x-tenant-id',
  'x-user-id',
  'x-user-role',
  'x-user-session-id',
] as const;

export type SessionIdentity = {
  tenantId?: string | null;
  id?: string | null;
  role?: string | null;
  userSessionId?: string | null;
};

/** Remove client-supplied identity headers before trusting session values. */
export function stripIdentityHeaders(headers: Headers): void {
  for (const name of IDENTITY_HEADERS) {
    headers.delete(name);
  }
}

/** Strip forged headers, then inject verified session identity only. */
export function applySessionIdentityHeaders(
  headers: Headers,
  user?: SessionIdentity | null,
): void {
  stripIdentityHeaders(headers);
  if (user?.tenantId) {
    headers.set('x-tenant-id', user.tenantId);
  }
  if (user?.id) {
    headers.set('x-user-id', user.id);
  }
  if (user?.role) {
    headers.set('x-user-role', user.role);
  }
  if (user?.userSessionId) {
    headers.set('x-user-session-id', user.userSessionId);
  }
}

/** Production fails closed; development requires explicit opt-in. */
export function isAuthRequired(): boolean {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction
    ? process.env.REQUIRE_AUTH !== 'false'
    : process.env.REQUIRE_AUTH === 'true';
}

export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io wss: ws:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}