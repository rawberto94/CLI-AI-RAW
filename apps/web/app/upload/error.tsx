'use client';

import { ErrorBoundary } from '@/components/error';

export default function UploadError({
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
      title="Upload Error"
      description="Failed to process upload. Please try again."
    />
  );
}
