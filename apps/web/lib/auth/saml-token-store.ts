/**
 * In-memory SAML token store for SSO bridge authentication.
 *
 * In production, replace with Redis or a database-backed store.
 */

export interface SamlTokenPayload {
  email: string;
  name: string;
  tenantId?: string;
  role?: string;
  expiresAt: number;
}

const store = new Map<string, SamlTokenPayload>();

const CLEANUP_INTERVAL_MS = 60_000;

function cleanup() {
  const now = Date.now();
  for (const [token, data] of store.entries()) {
    if (data.expiresAt < now) store.delete(token);
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();

export const samlTokenStore = {
  set(token: string, payload: Omit<SamlTokenPayload, 'expiresAt'>, ttlMs = 5 * 60 * 1000) {
    store.set(token, { ...payload, expiresAt: Date.now() + ttlMs });
  },
  get(token: string): SamlTokenPayload | undefined {
    cleanup();
    return store.get(token);
  },
  delete(token: string) {
    store.delete(token);
  },
  has(token: string): boolean {
    cleanup();
    const data = store.get(token);
    return !!data && data.expiresAt > Date.now();
  },
};
