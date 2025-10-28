/**
 * Redirect: /import → /rate-cards/dashboard
 * Import functionality has been consolidated into respective modules
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportRedirect() {
  const router = useRouter();

  useEffect() => {
    router.replace('/rate-cards/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
        <p className="text-gray-600">Import functionality is now available in each module</p>
        <p className="text-sm text-gray-500 mt-2">
          Rate Cards: Rate Cards → Dashboard<br />
          Contracts: Contracts → Upload
        </p>
      </div>
    </div>
  );
}
