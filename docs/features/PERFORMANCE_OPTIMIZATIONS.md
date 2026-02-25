# Performance Optimizations

This document outlines the performance optimizations implemented in the ConTigo platform.

## Bundle Optimizations

### 1. Package Import Optimization (next.config.mjs)

The following packages have optimized imports to reduce bundle size:

```javascript
optimizePackageImports: [
  'lucide-react',      // Icon library - only imports used icons
  '@radix-ui/react-*', // UI primitives - modular imports
  'framer-motion',     // Animation library - tree-shakeable
  'recharts',          // Charting - imports specific components
  'date-fns',          // Date utilities - only used functions
  '@aws-sdk/*',        // AWS SDK v3 - modular
  'zod',               // Validation - tree-shakeable
]
```

### 2. Lazy-Loaded Charts (components/charts/lazy-charts.tsx)

Heavy chart components are code-split to avoid loading Recharts (~100KB) on pages that don't need it:

```tsx
import { LazyLineChart, LazyBarChart, ChartSkeleton } from '@/components/charts/lazy-charts';

// Usage with Suspense
<Suspense fallback={<ChartSkeleton />}>
  <LazyLineChart data={data} />
</Suspense>
```

### 3. Webpack Configuration

- **webpackBuildWorker**: Enabled parallel compilation
- **parallelServerBuildTraces**: Parallel trace collection
- **parallelServerCompiles**: Parallel server compilation
- **Split chunks**: Max 244KB per chunk for optimal loading

## Caching Strategy

### 1. HTTP Cache Headers (lib/api-performance.ts)

Standardized cache presets for API responses:

| Preset | Cache-Control Header | Use Case |
|--------|---------------------|----------|
| `stats` | `private, max-age=60, stale-while-revalidate=300` | Dashboard stats |
| `dynamic` | `private, max-age=30, stale-while-revalidate=120` | List views |
| `static` | `public, max-age=86400, stale-while-revalidate=3600` | Reference data |
| `realtime` | `no-store, must-revalidate` | User-specific data |

### 2. Redis Caching (lib/cache.ts)

Server-side caching for expensive operations:

```typescript
import { withCache, CacheKeys, CacheTTL } from '@/lib/cache';

// Example: Cache contract stats for 60 seconds
const stats = await withCache(
  CacheKeys.contractStats(),
  () => fetchExpensiveStats(),
  { ttl: CacheTTL.short }
);
```

### 3. Cache TTL Values

| Name | Duration | Use Case |
|------|----------|----------|
| `default` | 5 min | General API responses |
| `short` | 1 min | Stats/analytics |
| `medium` | 10 min | List views |
| `long` | 1 hour | Reference data |
| `day` | 24 hours | Static lookups |

## Database Optimizations

### 1. Connection Pooling (PgBouncer)

- Production uses PgBouncer for connection pooling
- Transaction pooling mode for best performance
- 50 default pool size, 25 reserve connections

### 2. Query Optimization

- Parallel queries with `Promise.all()` for aggregations
- Select only needed fields to reduce data transfer
- Proper indexes on commonly queried columns

## Build Performance

### 1. Turborepo Configuration (turbo.json)

- Daemon mode enabled for faster incremental builds
- Build caching with proper output tracking
- Parallel task execution

### 2. Development Server

- Turbopack enabled for faster HMR
- 8GB Node heap size for large builds

## Image Optimization

### 1. Next.js Image Config

```javascript
images: {
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 31536000, // 1 year
}
```

### 2. Security Headers

Static assets cached for 1 year with immutable flag.

## Loading States

### 1. Route-Level Loading (loading.tsx)

115+ loading.tsx files provide instant visual feedback during navigation.

### 2. Suspense Boundaries

Components wrapped in Suspense for progressive loading:

```tsx
<Suspense fallback={<LoadingSkeleton />}>
  <HeavyComponent />
</Suspense>
```

## API Performance Utilities

### Response Timing

```typescript
import { createTimer, withPerformanceHeaders } from '@/lib/api-performance';

const timer = createTimer();
// ... do work ...
return withPerformanceHeaders(response, {
  cacheControl: 'stats',
  timing: timer.elapsed(),
  hit: false
});
```

### Request Deduplication

Prevents duplicate requests for the same resource:

```typescript
import { deduplicatedFetch } from '@/lib/api-performance';

const data = await deduplicatedFetch('key', () => fetchData());
```

## Monitoring

### Performance Headers

All API responses include:
- `X-Response-Time`: Request duration in ms
- `X-Cache`: HIT/MISS for cached responses
- `Server-Timing`: Standard performance timing

## Recommendations for New Features

1. **Heavy Components**: Use `next/dynamic` with `ssr: false` for client-only components
2. **API Routes**: Apply appropriate cache presets from `CachePresets`
3. **Database Queries**: Use `withCache()` for expensive aggregations
4. **Images**: Always use `next/image` component
5. **Lists**: Implement virtualization for >100 items
