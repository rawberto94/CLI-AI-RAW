'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

/**
 * SAML / OIDC Success Bridge Page
 *
 * Reads one-time SSO bridge token from HttpOnly cookie via /api/auth/saml/consume,
 * then exchanges it for a NextAuth session (credentials + samlToken).
 */

export default function SAMLBridgePage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      try {
        const res = await fetch('/api/auth/saml/consume', {
          method: 'POST',
          credentials: 'include',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.data?.samlToken) {
          if (!cancelled) {
            setError(body?.error?.message || 'Missing authentication token');
          }
          return;
        }

        await signIn('credentials', {
          samlToken: body.data.samlToken,
          callbackUrl: callbackUrl.startsWith('/') ? callbackUrl : '/dashboard',
          redirect: true,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Authentication failed');
        }
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [callbackUrl]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Failed</h2>
          <p className="text-slate-500">{error}</p>
          <a href="/auth/signin" className="mt-4 inline-block text-violet-600 underline text-sm">
            Back to sign in
          </a>
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
