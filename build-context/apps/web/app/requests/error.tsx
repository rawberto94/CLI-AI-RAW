'use client';

import { ErrorBoundary } from '@/components/error';

export default function RequestsError({
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
      title="Requests Error"
      description="Failed to load request data. Please try again."
    />
  );
}
