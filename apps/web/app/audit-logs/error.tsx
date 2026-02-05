'use client';

import { ErrorBoundary } from '@/components/error';

export default function AuditLogsError({
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
      title="Audit Logs Error"
      description="Failed to load audit logs. Please try again."
    />
  );
}
