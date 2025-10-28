/**
 * Redirect: /benchmarks → /rate-cards/benchmarking
 * This page has been consolidated into the Rate Cards module
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BenchmarksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/rate-cards/benchmarking');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
        <p className="text-gray-600">This page has moved to Rate Cards → Benchmarking</p>
      </div>
    </div>
  );
}
