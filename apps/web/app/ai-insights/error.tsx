'use client';

import { ErrorBoundary } from '@/components/error';

export default function AIInsightsError({
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
      title="AI Insights Error"
      description="Failed to load AI insights. Please try again."
    />
  );
}
