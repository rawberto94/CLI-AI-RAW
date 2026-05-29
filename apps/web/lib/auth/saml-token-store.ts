/**
 * Redis-backed SAML token store for SSO bridge authentication.
 *
 * Survives process restarts and works across multiple App Service instances.
 */

import { redis } from '@/lib/redis';

export interface SamlTokenPayload {
  email: string;
  name: string;
  tenantId?: string;
  role?: string;
  expiresAt: number;
}

const REDIS_KEY_PREFIX = 'saml:token:';
const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes

function key(token: string): string {
  return `${REDIS_KEY_PREFIX}${token}`;
}

export const samlTokenStore = {
  async set(token: string, payload: Omit<SamlTokenPayload, 'expiresAt'>, ttlSeconds = DEFAULT_TTL_SECONDS) {
    const data: SamlTokenPayload = {
      ...payload,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    await redis.set(key(token), JSON.stringify(data), 'EX', ttlSeconds);
  },

  async get(token: string): Promise<SamlTokenPayload | undefined> {
    const raw = await redis.get(key(token));
    if (!raw) return undefined;
    try {
      const data = JSON.parse(raw) as SamlTokenPayload;
      if (data.expiresAt < Date.now()) {
        await redis.del(key(token));
        return undefined;
      }
      return data;
    } catch {
      await redis.del(key(token));
      return undefined;
    }
  },

  async delete(token: string) {
    await redis.del(key(token));
  },

  async has(token: string): Promise<boolean> {
    const raw = await redis.get(key(token));
    if (!raw) return false;
    try {
      const data = JSON.parse(raw) as SamlTokenPayload;
      if (data.expiresAt < Date.now()) {
        await redis.del(key(token));
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },
};
