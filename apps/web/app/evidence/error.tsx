'use client';

import { ErrorBoundary } from '@/components/error';

export default function EvidenceError({
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
      title="Evidence Vault Error"
      description="Failed to load evidence data. Please try again."
    />
  );
}
