'use client';

import { ErrorBoundary } from '@/components/error';

export default function RenewalsError({
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
      title="Renewals Error"
      description="Failed to load renewal data. Please try again."
    />
  );
}
