'use client';

import { ErrorBoundary } from '@/components/error';

export default function GovernanceError({
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
      title="Governance Error"
      description="Failed to load governance data. Please try again."
    />
  );
}
