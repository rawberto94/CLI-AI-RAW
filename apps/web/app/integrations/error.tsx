'use client';

import { ErrorBoundary } from '@/components/error';

export default function IntegrationsError({
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
      title="Integrations Error"
      description="Failed to load integrations. Please try again."
    />
  );
}
