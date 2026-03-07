'use client';

import { ErrorBoundary } from '@/components/error';

export default function TemplatesError({
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
      title="Templates Error"
      description="Failed to load templates. Please try again."
    />
  );
}
