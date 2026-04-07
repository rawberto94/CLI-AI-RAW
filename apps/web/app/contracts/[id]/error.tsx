'use client';

import { ErrorBoundary } from '@/components/error';

export default function ContractDetailError({
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
      title="Contract Error"
      description="Failed to load contract details. The contract may have been deleted or you may not have access."
    />
  );
}
