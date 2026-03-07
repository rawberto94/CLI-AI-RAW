'use client';

import { ErrorBoundary } from '@/components/error';

export default function SettingsError({
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
      title="Settings Error"
      description="Failed to load settings. Please try again."
    />
  );
}
