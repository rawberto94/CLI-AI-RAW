/**
 * Redirect: /jobs → /contracts/bulk
 * Jobs functionality has been renamed to Bulk Operations
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JobsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/contracts/bulk');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
        <p className="text-gray-600">This page has moved to Contracts → Bulk Operations</p>
      </div>
    </div>
  );
}
