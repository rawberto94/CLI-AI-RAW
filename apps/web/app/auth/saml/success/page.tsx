'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

/**
 * SAML Success Bridge Page
 *
 * Exchanges the SAML token for a NextAuth session via credentials provider.
 */

export default function SAMLBridgePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    if (!token) {
      setError('Missing authentication token');
      return;
    }

    // Exchange SAML token for session via credentials provider
    signIn('credentials', {
      samlToken: token,
      callbackUrl,
      redirect: true,
    }).catch((err) => {
      setError(err?.message || 'Authentication failed');
    });
  }, [token, callbackUrl]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Failed</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto mb-4" />
        <h2 className="text-lg font-medium">Completing sign-in...</h2>
        <p className="text-sm text-slate-500 mt-1">Please wait while we set up your session</p>
      </div>
    </div>
  );
}
