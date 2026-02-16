'use client';

import { ErrorBoundary } from '@/components/error';

export default function GenerateError({
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
      title="Generation Error"
      description="Failed to generate content. Please try again."
    />
  );
}
