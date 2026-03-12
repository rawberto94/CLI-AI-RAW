/**
 * Redis Client
 * 
 * Shared Redis client for caching, sessions, and real-time features
 */

import Redis from 'ioredis';

type RedisInstance = InstanceType<typeof Redis>;

const redisUrl = process.env.REDIS_URL;

// Null Redis client for build time when REDIS_URL is not available
class NullRedis {
  async publish(): Promise<number> { return 0; }
  async subscribe(): Promise<void> {}
  async unsubscribe(): Promise<void> {}
  async get(): Promise<string | null> { return null; }
  async set(): Promise<'OK'> { return 'OK'; }
  async del(): Promise<number> { return 0; }
  async keys(): Promise<string[]> { return []; }
  async ping(): Promise<string> { return 'PONG'; }
  duplicate(): NullRedis { return new NullRedis(); }
  async connect(): Promise<void> {}
  async quit(): Promise<void> {}
  on(): this { return this; }
}

function createRedisClient(): RedisInstance | NullRedis {
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not configured, using null Redis client');
    return new NullRedis() as unknown as RedisInstance;
  }
  
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true, // Don't connect immediately
  });

  // Handle connection events
  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err);
  });

  return client;
}

export const redis = createRedisClient();

export default redis;
