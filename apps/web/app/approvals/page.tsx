'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy /approvals route — retargeted to the unified Needs you inbox (Phase 1.4).
 * Previously redirected to /workflows?tab=queue.
 */
export default function ApprovalsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inbox');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-600">Redirecting to Needs you…</p>
      </div>
    </div>
  );
}
