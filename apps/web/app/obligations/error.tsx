'use client';

import { ErrorBoundary } from '@/components/error';

export default function ObligationsError({
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
      title="Obligations Error"
      description="Failed to load obligations. Please try again."
    />
  );
}
