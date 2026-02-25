'use client';

import React, { Suspense, lazy, ComponentType } from 'react';
import { Skeleton, SkeletonContractOverview } from '@/components/ui/skeleton';

// ── Types ────────────────────────────────────────────────────────────

interface ProgressiveLoaderProps {
  children: React.ReactNode;
  /** Fallback override — by default a skeleton matched to priority */
  fallback?: React.ReactNode;
  /** Priority controls fallback appearance and whether Suspense is used */
  priority?: 'critical' | 'high' | 'normal' | 'low';
}

// ── Default fallbacks by priority ────────────────────────────────────

function DefaultFallback({ priority }: { priority: string }) {
  switch (priority) {
    case 'high':
      return <SkeletonContractOverview />;
    case 'normal':
      return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
    case 'low':
      return null; // No visual fallback — render nothing until ready
    default:
      return null;
  }
}

// ── Component ────────────────────────────────────────────────────────

/**
 * Priority-based progressive loading wrapper.
 *
 * - `critical` — no Suspense, renders children immediately (blocks paint)
 * - `high` — SkeletonContractOverview fallback
 * - `normal` — generic skeleton pulse
 * - `low` — invisible fallback
 */
export function ProgressiveLoader({
  children,
  fallback,
  priority = 'normal',
}: ProgressiveLoaderProps) {
  // Critical content should never suspend — render immediately
  if (priority === 'critical') {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={fallback ?? <DefaultFallback priority={priority} />}>
      {children}
    </Suspense>
  );
}

// ── Predefined page loaders ──────────────────────────────────────────

/**
 * Contract detail page progressive loader with priority zones.
 *
 * Usage:
 * ```tsx
 * <ContractDetailLoader
 *   header={<ContractHeader id={id} />}
 *   metadata={<ContractMetadata id={id} />}
 *   artifacts={<ContractArtifacts id={id} />}
 *   analysis={<AIAnalysisPanel id={id} />}
 * />
 * ```
 */
export function ContractDetailLoader({
  header,
  metadata,
  artifacts,
  analysis,
}: {
  header: React.ReactNode;
  metadata: React.ReactNode;
  artifacts: React.ReactNode;
  analysis?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {/* Critical: Header — immediately rendered, no fallback */}
      <ProgressiveLoader priority="critical">{header}</ProgressiveLoader>

      {/* High: Key metadata — skeleton until loaded */}
      <ProgressiveLoader priority="high">{metadata}</ProgressiveLoader>

      {/* Normal: Artifacts — pulse placeholder */}
      <ProgressiveLoader priority="normal">{artifacts}</ProgressiveLoader>

      {/* Low: AI analysis — invisible until ready */}
      {analysis && (
        <ProgressiveLoader priority="low">{analysis}</ProgressiveLoader>
      )}
    </div>
  );
}

// ── Lazy-load helper ─────────────────────────────────────────────────

/**
 * Create a lazy component with integrated ProgressiveLoader.
 *
 * ```ts
 * const LazyChart = lazyWithLoader(() => import('./HeavyChart'), 'low');
 * ```
 */
export function lazyWithLoader<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  priority: ProgressiveLoaderProps['priority'] = 'normal',
) {
  const LazyComponent = lazy(factory);

  return function LazyWithFallback(props: P) {
    return (
      <ProgressiveLoader priority={priority}>
        <LazyComponent {...props} />
      </ProgressiveLoader>
    );
  };
}
