'use client';

import { ErrorBoundary } from '@/components/error';

export default function ReportsError({
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
      title="Reports Error"
      description="Failed to generate reports. Please try again."
    />
  );
}
