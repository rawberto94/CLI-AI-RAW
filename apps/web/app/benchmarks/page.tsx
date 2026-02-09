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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
        <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">Redirecting...</h2>
        <p className="text-slate-600">This page has moved to Rate Cards → Benchmarking</p>
      </div>
    </div>
  );
}
