'use client';

import { ErrorBoundary } from '@/components/error';

export default function DashboardError({
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
      title="Dashboard Error"
      description="Failed to load dashboard data. Please try refreshing."
    />
  );
}
