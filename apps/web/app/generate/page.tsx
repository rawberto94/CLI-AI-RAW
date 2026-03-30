'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * /generate → redirects to /drafting (Document Studio)
 *
 * Preserves query parameters (e.g. ?create=renewal&from=xxx) so that
 * deep-links from other features continue to work.
 */
export default function GenerateRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(params ? `/drafting?${params}` : '/drafting');
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-slate-500">Redirecting to Document Studio…</p>
    </div>
  );
}
