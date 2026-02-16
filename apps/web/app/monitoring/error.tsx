'use client';

import { ErrorBoundary } from '@/components/error';

export default function MonitoringError({
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
      title="Monitoring Error"
      description="Failed to load monitoring data. Please try again."
    />
  );
}
