'use client';

import { ErrorBoundary } from '@/components/error';

export default function DocumentExpiryError({
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
      title="Document Expiry Error"
      description="Failed to load document expiry data. Please try again."
    />
  );
}
