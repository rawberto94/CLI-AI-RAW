'use client';

import { ErrorBoundary } from '@/components/error';

export default function AIError({
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
      title="AI Assistant Error"
      description="Failed to load the AI assistant. Please try again."
    />
  );
}
