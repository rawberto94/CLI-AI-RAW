'use client';

import { ErrorBoundary } from '@/components/error';

export default function AmendmentsError({
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
      title="Amendments Error"
      description="Failed to load amendment data. Please try again."
    />
  );
}
