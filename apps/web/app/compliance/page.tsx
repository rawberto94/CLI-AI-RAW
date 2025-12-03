/**
 * Redirect: /compliance → /settings
 * Compliance features will be available in Settings when fully developed
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ComplianceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
        <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Redirecting...</h2>
        <p className="text-muted-foreground">Compliance features are being developed</p>
        <p className="text-sm text-muted-foreground mt-2">
          They will be available in Settings when ready
        </p>
      </div>
    </div>
  );
}
