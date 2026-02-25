# ConTigo Platform Enhancement Implementation Plan

> **Version:** 1.0  
> **Date:** February 2026  
> **Status:** Ready for Execution  
> **Estimated Duration:** 16 Weeks  
> **Team Size:** 4-6 Engineers (2 Frontend, 2 Backend, 1-2 AI/ML)

---

## 📋 Executive Summary

This implementation plan delivers a comprehensive enhancement to ConTigo's performance, responsiveness, and agentic AI capabilities. The plan is organized into 4 phases with clear deliverables, dependencies, and success metrics.

### Key Outcomes

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| First Contentful Paint | ~2.5s | <1.5s | 40% faster |
| AI Artifact Load Time | ~5s | <2s | 60% faster |
| Agent Task Success Rate | ~85% | >95% | +10% improvement |
| User Engagement (AI features) | Baseline | +50% | More agent adoption |
| Bundle Size (Initial) | ~350KB | <200KB | 43% reduction |

---

## 🗺️ Implementation Roadmap

```
Week:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
       |--Phase 1--|--Phase 2------|--Phase 3----------|--Phase 4--|
       
Phase 1: Quick Wins & Foundation (Weeks 1-2)
Phase 2: Performance Optimization (Weeks 3-6)
Phase 3: Agentic AI Enhancement (Weeks 7-12)
Phase 4: Advanced Features & Polish (Weeks 13-16)
```

---

## Phase 1: Quick Wins & Foundation (Weeks 1-2)

**Goal:** Deliver immediate value with low-risk changes
**Team:** 2 Frontend, 1 Backend
**Deliverables:** 5 completed features

### Week 1: Bundle Optimization & Caching

#### 1.1 Enable Next.js Experimental Optimizations
**Owner:** Frontend Lead
**Effort:** 2 days
**Files:** `apps/web/next.config.js`

```javascript
// apps/web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable React Compiler for automatic memoization
    reactCompiler: true,
    
    // Optimize package imports for common heavy packages
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-icons',
      'framer-motion',
      'date-fns',
    ],
    
    // Enable partial prerendering for dynamic content
    ppr: true,
    
    // Turbopack for faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Webpack optimizations
  webpack: (config, { isServer, nextRuntime }) => {
    // Only apply to client-side builds
    if (!isServer && nextRuntime !== 'edge') {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000, // Stay under 250KB for HTTP/2
        cacheGroups: {
          // Core framework
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'framework',
            chunks: 'all',
            priority: 40,
          },
          // UI component libraries
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|@headlessui)[\\/]/,
            name: 'ui-vendor',
            chunks: 'all',
            priority: 30,
          },
          // AI/ML libraries (lazy loaded)
          ai: {
            test: /[\\/]node_modules[\\/](langchain|@langchain|openai|anthropic)[\\/]/,
            name: 'ai-vendor',
            chunks: 'async',
            priority: 20,
          },
          // Charts and visualization
          viz: {
            test: /[\\/]node_modules[\\/](recharts|d3|chart.js)[\\/]/,
            name: 'viz-vendor',
            chunks: 'async',
            priority: 20,
          },
          // Default vendor chunk
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
      
      // Tree shaking optimizations
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }
    
    return config;
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.contigo-app.ch' },
    ],
    minimumCacheTTL: 86400, // 24 hours
  },
  
  // Compression
  compress: true,
  
  // Headers for caching
  async headers() {
    return [
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/contracts/(.*)/artifacts',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=300, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

**Success Criteria:**
- [ ] Build completes without errors
- [ ] Initial bundle size reduced by >20%
- [ ] Lighthouse performance score improves by >10 points

---

#### 1.2 Implement Smart Data Prefetching Hook
**Owner:** Frontend Engineer
**Effort:** 2 days
**Files:** 
- `apps/web/hooks/useSmartPrefetch.ts` (new)
- `apps/web/components/contracts/ContractList.tsx` (modify)

```typescript
// apps/web/hooks/useSmartPrefetch.ts
'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface PrefetchOptions {
  priority?: 'high' | 'normal' | 'low';
  staleTime?: number;
}

const PRIORITY_STALE_TIME = {
  high: 5 * 60 * 1000,    // 5 minutes
  normal: 60 * 1000,       // 1 minute
  low: 30 * 1000,          // 30 seconds
};

export function useSmartPrefetch() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Prefetch contract details with priority-based stale time
   */
  const prefetchContract = useCallback((contractId: string, options: PrefetchOptions = {}) => {
    const { priority = 'normal', staleTime = PRIORITY_STALE_TIME[priority] } = options;
    
    // Clear any existing prefetch timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }
    
    // Debounce prefetch to avoid excessive requests on rapid hover
    prefetchTimeoutRef.current = setTimeout(() => {
      // Prefetch contract data
      queryClient.prefetchQuery({
        queryKey: ['contract', contractId],
        queryFn: async () => {
          const res = await fetch(`/api/contracts/${contractId}`);
          if (!res.ok) throw new Error('Failed to fetch contract');
          return res.json();
        },
        staleTime,
      });
      
      // Prefetch related data based on priority
      if (priority === 'high') {
        // Prefetch artifacts for high-priority items
        queryClient.prefetchQuery({
          queryKey: ['contract', contractId, 'artifacts'],
          queryFn: async () => {
            const res = await fetch(`/api/contracts/${contractId}/artifacts`);
            if (!res.ok) throw new Error('Failed to fetch artifacts');
            return res.json();
          },
          staleTime: staleTime / 2, // Shorter stale time for artifacts
        });
      }
      
      // Preload the route for instant navigation
      router.prefetch(`/contracts/${contractId}`);
    }, 100); // 100ms debounce
  }, [queryClient, router]);
  
  /**
   * Prefetch multiple contracts (for batch operations)
   */
  const prefetchContracts = useCallback((contractIds: string[]) => {
    // Use requestIdleCallback for non-critical prefetching
    const schedulePrefetch = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? window.requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 1);
    
    schedulePrefetch(() => {
      contractIds.forEach((id, index) => {
        // Stagger prefetch to avoid overwhelming the server
        setTimeout(() => {
          prefetchContract(id, { priority: 'low', staleTime: 30000 });
        }, index * 50);
      });
    });
  }, [prefetchContract]);
  
  /**
   * Cancel pending prefetch operations
   */
  const cancelPrefetch = useCallback(() => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
      prefetchTimeoutRef.current = null;
    }
  }, []);
  
  return {
    prefetchContract,
    prefetchContracts,
    cancelPrefetch,
  };
}

// Hook for prefetching on scroll
export function usePrefetchOnScroll(contracts: Array<{ id: string }>) {
  const { prefetchContracts } = useSmartPrefetch();
  const prefetchedRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIds = entries
          .filter(entry => entry.isIntersecting)
          .map(entry => entry.target.getAttribute('data-contract-id'))
          .filter((id): id is string => !!id && !prefetchedRef.current.has(id));
        
        if (visibleIds.length > 0) {
          visibleIds.forEach(id => prefetchedRef.current.add(id));
          prefetchContracts(visibleIds);
        }
      },
      { rootMargin: '200px' } // Start prefetching 200px before visible
    );
    
    // Observe all contract rows
    contracts.forEach(contract => {
      const element = document.querySelector(`[data-contract-id="${contract.id}"]`);
      if (element) observer.observe(element);
    });
    
    return () => observer.disconnect();
  }, [contracts, prefetchContracts]);
}
```

**Usage in ContractList:**

```typescript
// apps/web/components/contracts/ContractList.tsx
export function ContractList({ contracts }: { contracts: Contract[] }) {
  const { prefetchContract, cancelPrefetch } = useSmartPrefetch();
  
  return (
    <div className="space-y-2">
      {contracts.map(contract => (
        <div
          key={contract.id}
          data-contract-id={contract.id}
          onMouseEnter={() => prefetchContract(contract.id, { priority: 'high' })}
          onMouseLeave={cancelPrefetch}
          onFocus={() => prefetchContract(contract.id, { priority: 'high' })}
          onBlur={cancelPrefetch}
        >
          <ContractRow contract={contract} />
        </div>
      ))}
    </div>
  );
}
```

**Success Criteria:**
- [ ] Hovering a contract triggers prefetch within 100ms
- [ ] Navigation to contract detail feels instantaneous
- [ ] No excessive API calls (debouncing works)

---

#### 1.3 Implement Progressive Loading Components
**Owner:** Frontend Engineer
**Effort:** 2 days
**Files:**
- `apps/web/components/loading/ProgressiveLoader.tsx` (new)
- `apps/web/components/contracts/CriticalContractData.tsx` (new)
- `apps/web/app/contracts/[id]/page.tsx` (modify)

```typescript
// apps/web/components/loading/ProgressiveLoader.tsx
'use client';

import { Suspense } from 'react';
import { SkeletonContractOverview } from '@/components/ui/skeleton';

interface ProgressiveLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  priority?: 'critical' | 'high' | 'normal' | 'low';
}

/**
 * Progressive loading with priority-based suspense boundaries
 */
export function ProgressiveLoader({ 
  children, 
  fallback,
  priority = 'normal' 
}: ProgressiveLoaderProps) {
  // Critical content never shows fallback (blocks render)
  if (priority === 'critical') {
    return <>{children}</>;
  }
  
  return (
    <Suspense fallback={fallback || <DefaultFallback priority={priority} />}>
      {children}
    </Suspense>
  );
}

function DefaultFallback({ priority }: { priority: string }) {
  // Different fallback based on priority
  switch (priority) {
    case 'high':
      return <SkeletonContractOverview />;
    case 'normal':
      return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
    case 'low':
      return null; // No visual fallback for low priority
    default:
      return null;
  }
}

// Predefined priority zones for contract detail page
export function ContractDetailLoader({ contractId }: { contractId: string }) {
  return (
    <div className="space-y-6">
      {/* Critical: Header - always render immediately */}
      <ProgressiveLoader priority="critical">
        <ContractHeader contractId={contractId} />
      </ProgressiveLoader>
      
      {/* High: Key metadata */}
      <ProgressiveLoader priority="high" fallback={<SkeletonContractOverview />}>
        <ContractMetadata contractId={contractId} />
      </ProgressiveLoader>
      
      {/* Normal: Artifacts */}
      <ProgressiveLoader priority="normal">
        <ContractArtifacts contractId={contractId} />
      </ProgressiveLoader>
      
      {/* Low: AI analysis and recommendations */}
      <ProgressiveLoader priority="low">
        <AIAnalysisPanel contractId={contractId} />
      </ProgressiveLoader>
    </div>
  );
}
```

**Success Criteria:**
- [ ] Contract header renders immediately
- [ ] Skeleton placeholders match final layout (no layout shift)
- [ ] Cumulative Layout Shift (CLS) < 0.1

---

### Week 2: Query Optimization & API Response Caching

#### 1.4 Implement Request Deduplication & Batching
**Owner:** Backend Engineer
**Effort:** 3 days
**Files:**
- `packages/data-orchestration/src/utils/query-batcher.ts` (new)
- `packages/data-orchestration/src/services/contract.service.ts` (modify)

```typescript
// packages/data-orchestration/src/utils/query-batcher.ts

interface BatchedRequest<T, R> {
  key: string;
  execute: () => Promise<R>;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Deduplicates concurrent identical requests
 * Batches requests that occur within the same tick
 */
export class QueryBatcher<T, R> {
  private pending = new Map<string, Promise<R>>();
  private batchQueue = new Map<string, BatchedRequest<T, R>>();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly batchWindowMs: number;
  
  constructor(options: { batchWindowMs?: number } = {}) {
    this.batchWindowMs = options.batchWindowMs ?? 5; // 5ms batching window
  }
  
  /**
   * Execute or deduplicate a request
   */
  async execute(key: string, fn: () => Promise<R>): Promise<R> {
    // Return existing pending promise (deduplication)
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }
    
    // Create new promise
    const promise = fn().finally(() => {
      this.pending.delete(key);
    });
    
    this.pending.set(key, promise);
    return promise;
  }
  
  /**
   * Add to batch queue for grouped execution
   */
  batch(
    key: string, 
    item: T, 
    batchExecutor: (items: T[]) => Promise<Map<string, R>>
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batchQueue.set(key, {
        key,
        execute: async () => {
          const items = Array.from(this.batchQueue.values()).map(r => item);
          const results = await batchExecutor(items);
          return results.get(key)!;
        },
        resolve,
        reject,
        timestamp: Date.now(),
      });
      
      // Schedule batch execution
      this.scheduleBatchExecution(batchExecutor);
    });
  }
  
  private scheduleBatchExecution<T>(
    batchExecutor: (items: T[]) => Promise<Map<string, R>>
  ): void {
    if (this.batchTimeout) return; // Already scheduled
    
    this.batchTimeout = setTimeout(() => {
      this.executeBatch(batchExecutor);
    }, this.batchWindowMs);
  }
  
  private async executeBatch<T>(
    batchExecutor: (items: T[]) => Promise<Map<string, R>>
  ): Promise<void> {
    const batch = new Map(this.batchQueue);
    this.batchQueue.clear();
    this.batchTimeout = null;
    
    try {
      const items = Array.from(batch.values()).map(r => r.key);
      const results = await batchExecutor(items as T[]);
      
      // Resolve individual promises
      batch.forEach((request, key) => {
        const result = results.get(key);
        if (result !== undefined) {
          request.resolve(result);
        } else {
          request.reject(new Error(`No result for key: ${key}`));
        }
      });
    } catch (error) {
      // Reject all on batch failure
      batch.forEach(request => {
        request.reject(error as Error);
      });
    }
  }
  
  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pending.clear();
    this.batchQueue.clear();
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}

// Singleton instances for common batch operations
export const contractBatcher = new QueryBatcher<string, Contract>({ batchWindowMs: 10 });
export const artifactBatcher = new QueryBatcher<{ contractId: string; type: string }, Artifact>({ batchWindowMs: 20 });
```

**Integration in Contract Service:**

```typescript
// packages/data-orchestration/src/services/contract.service.ts
import { contractBatcher } from '../utils/query-batcher';

export class ContractService {
  async getContract(id: string): Promise<Contract> {
    return contractBatcher.execute(`contract:${id}`, async () => {
      // This will only execute once even if called multiple times concurrently
      return prisma.contract.findUnique({
        where: { id },
        include: {
          parties: true,
          metadata: true,
        },
      });
    });
  }
  
  async getContractsBatch(ids: string[]): Promise<Map<string, Contract>> {
    const contracts = await prisma.contract.findMany({
      where: { id: { in: ids } },
    });
    
    return new Map(contracts.map(c => [c.id, c]));
  }
}
```

**Success Criteria:**
- [ ] Identical concurrent requests are deduplicated
- [ ] Batch requests reduce DB query count by >50%

---

#### 1.5 Implement API Response Caching with ETags
**Owner:** Backend Engineer
**Effort:** 2 days
**Files:**
- `apps/web/lib/cache/etag-cache.ts` (new)
- `apps/web/app/api/contracts/[id]/route.ts` (modify)

```typescript
// apps/web/lib/cache/etag-cache.ts

interface CacheEntry<T> {
  data: T;
  etag: string;
  timestamp: number;
  ttl: number;
}

/**
 * ETag-based client-side cache for API responses
 */
export class ETagCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;
  
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes
    this.defaultTTL = defaultTTL;
  }
  
  /**
   * Generate ETag from data
   */
  generateETag(data: unknown): string {
    const str = JSON.stringify(data);
    // Simple hash for ETag
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `"${hash.toString(16)}"`;
  }
  
  /**
   * Get cached data if valid
   */
  get<T>(key: string): { data: T; etag: string } | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return { data: entry.data, etag: entry.etag };
  }
  
  /**
   * Store data in cache
   */
  set<T>(key: string, data: T, ttl?: number): string {
    const etag = this.generateETag(data);
    this.cache.set(key, {
      data,
      etag,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
    return etag;
  }
  
  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
export const apiCache = new ETagCache();

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => apiCache.cleanup(), 5 * 60 * 1000);
}
```

**API Route with ETags:**

```typescript
// apps/web/app/api/contracts/[id]/route.ts
import { apiCache } from '@/lib/cache/etag-cache';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cacheKey = `contract:${params.id}`;
  
  // Check If-None-Match header
  const ifNoneMatch = req.headers.get('If-None-Match');
  
  // Check cache
  const cached = apiCache.get(cacheKey);
  if (cached) {
    // Return 304 if ETag matches
    if (ifNoneMatch === cached.etag) {
      return new Response(null, { status: 304 });
    }
    
    // Return cached data
    return Response.json(cached.data, {
      headers: {
        'ETag': cached.etag,
        'Cache-Control': 'private, max-age=300',
      },
    });
  }
  
  // Fetch fresh data
  const contract = await fetchContract(params.id);
  
  // Store in cache
  const etag = apiCache.set(cacheKey, contract);
  
  return Response.json(contract, {
    headers: {
      'ETag': etag,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
```

**Success Criteria:**
- [ ] 304 responses for unchanged resources
- [ ] Bandwidth usage reduced by >30%

---

## Phase 1 Deliverables Summary

| Feature | Status | Owner | Effort | Impact |
|---------|--------|-------|--------|--------|
| Next.js Optimizations | ⏳ | Frontend Lead | 2d | High |
| Smart Prefetching | ⏳ | Frontend Eng | 2d | High |
| Progressive Loading | ⏳ | Frontend Eng | 2d | Medium |
| Query Batching | ⏳ | Backend Eng | 3d | High |
| ETag Caching | ⏳ | Backend Eng | 2d | Medium |

**Phase 1 Success Metrics:**
- [ ] Bundle size reduced by 20%
- [ ] API response time improved by 30%
- [ ] Contract detail page load < 1.5s

---

## Phase 2: Performance Optimization (Weeks 3-6)

**Goal:** Achieve sub-second load times for critical paths
**Team:** 2 Frontend, 2 Backend
**Deliverables:** 8 completed features

### Week 3: Streaming & Virtualization

#### 2.1 Implement Streaming AI Artifact Generation
**Owner:** AI/ML Engineer
**Effort:** 4 days
**Files:**
- `apps/web/app/api/contracts/[id]/artifacts/stream/route.ts` (new)
- `apps/web/components/contracts/StreamingArtifactViewer.tsx` (new)

