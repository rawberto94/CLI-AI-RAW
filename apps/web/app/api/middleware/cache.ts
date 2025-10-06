/**
 * API Caching Middleware
 * Implements intelligent caching for API responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/core/cache/redis-cache.service';

interface CacheConfig {
  ttl: number;
  keyGenerator?: (req: NextRequest) => string;
  shouldCache?: (req: NextRequest, res: NextResponse) => boolean;
}

export function withCache(config: CacheConfig) {
  return async (
    handler: (req: NextRequest) => Promise<NextResponse>
  ) => {
    return async (req: NextRequest) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return handler(req);
      }

      // Generate cache key
      const cacheKey = config.keyGenerator
        ? config.keyGenerator(req)
        : `api:${req.nextUrl.pathname}:${req.nextUrl.search}`;

      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return new NextResponse(JSON.stringify(cached), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
          },
        });
      }

      // Execute handler
      const response = await handler(req);

      // Cache successful responses
      if (response.status === 200) {
        const shouldCache = config.shouldCache
          ? config.shouldCache(req, response)
          : true;

        if (shouldCache) {
          const data = await response.json();
          await cacheService.set(cacheKey, data, { ttl: config.ttl });
          
          return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'MISS',
            },
          });
        }
      }

      return response;
    };
  };
}

// Preset cache configurations
export const cachePresets = {
  short: { ttl: 60 }, // 1 minute
  medium: { ttl: 300 }, // 5 minutes
  long: { ttl: 3600 }, // 1 hour
  veryLong: { ttl: 86400 }, // 24 hours
};
