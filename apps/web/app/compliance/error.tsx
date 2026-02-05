'use client';

import { ErrorBoundary } from '@/components/error';

export default function ComplianceError({
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
      title="Compliance Error"
      description="Failed to load compliance data. Please try again."
    />
  );
}
