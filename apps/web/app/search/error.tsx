'use client';

import { ErrorBoundary } from '@/components/error';

export default function SearchError({
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
      title="Search Error"
      description="Failed to perform search. Please try again."
    />
  );
}
