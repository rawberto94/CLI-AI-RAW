'use client';

import { ErrorBoundary } from '@/components/error';

export default function AnalyticsError({
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
      title="Analytics Error"
      description="Failed to load analytics data. Please try again."
    />
  );
}
