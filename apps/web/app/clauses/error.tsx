'use client';

import { ErrorBoundary } from '@/components/error';

export default function ClausesError({
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
      title="Clauses Error"
      description="Failed to load clause library. Please try again."
    />
  );
}
