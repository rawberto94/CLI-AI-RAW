'use client';

import { ErrorBoundary } from '@/components/error';

export default function SpendError({
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
      title="Spend Analysis Error"
      description="Failed to load spend data. Please try again."
    />
  );
}
