/**
 * Redirect: /import → /rate-cards/dashboard
 * Import functionality has been consolidated into respective modules
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/rate-cards/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
        <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Redirecting...</h2>
        <p className="text-slate-600">Import functionality is now available in each module</p>
        <p className="text-sm text-slate-500 mt-2">
          Rate Cards: Rate Cards → Dashboard<br />
          Contracts: Contracts → Upload
        </p>
      </div>
    </div>
  );
}
