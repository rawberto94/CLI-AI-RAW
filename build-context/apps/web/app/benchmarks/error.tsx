'use client';

import { ErrorBoundary } from '@/components/error';

export default function BenchmarksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Benchmarks Error"
      description="Failed to load benchmark data. Please try again."
    />
  );
}
