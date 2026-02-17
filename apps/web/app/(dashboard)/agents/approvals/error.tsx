'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
      <p className="text-gray-500 text-center max-w-md">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
