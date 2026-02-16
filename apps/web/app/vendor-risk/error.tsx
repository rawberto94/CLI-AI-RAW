'use client';

import { ErrorBoundary } from '@/components/error';

export default function VendorRiskError({
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
      title="Vendor Risk Error"
      description="Failed to load vendor risk data. Please try again."
    />
  );
}
