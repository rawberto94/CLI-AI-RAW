'use client';

import { ErrorBoundary } from '@/components/error';

export default function AutomationError({
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
      title="Automation Error"
      description="Failed to load automation workflows. Please try again."
    />
  );
}
