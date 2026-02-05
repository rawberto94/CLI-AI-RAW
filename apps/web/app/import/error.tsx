'use client';

import { ErrorBoundary } from '@/components/error';

export default function ImportError({
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
      title="Import Error"
      description="Failed to process import. Please try again."
    />
  );
}
