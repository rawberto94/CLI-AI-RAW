'use client';

import { ErrorBoundary } from '@/components/error';

export default function RiskError({
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
      title="Risk Assessment Error"
      description="Failed to load risk data. Please try again."
    />
  );
}
