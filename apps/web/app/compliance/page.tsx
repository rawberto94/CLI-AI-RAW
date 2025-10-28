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
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
        <p className="text-gray-600">Compliance features are being developed</p>
        <p className="text-sm text-gray-500 mt-2">
          They will be available in Settings when ready
        </p>
      </div>
    </div>
  );
}
