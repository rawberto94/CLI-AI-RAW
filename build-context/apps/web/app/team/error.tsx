'use client';

import { ErrorBoundary } from '@/components/error';

export default function TeamError({
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
      title="Team Error"
      description="Failed to load team data. Please try again."
    />
  );
}
