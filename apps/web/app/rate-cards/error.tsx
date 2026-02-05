'use client';

import { ErrorBoundary } from '@/components/error';

export default function RateCardsError({
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
      title="Rate Cards Error"
      description="Failed to load rate card data. Please try again."
    />
  );
}
