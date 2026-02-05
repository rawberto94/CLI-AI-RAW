'use client';

import { ErrorBoundary } from '@/components/error';

export default function SuppliersError({
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
      title="Suppliers Error"
      description="Failed to load supplier data. Please try again."
    />
  );
}
