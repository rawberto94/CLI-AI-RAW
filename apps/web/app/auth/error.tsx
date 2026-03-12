'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    console.error('[Auth Error]', error.message, error.digest);
  }, [error]);

  const handleRetry = () => {
    setIsRetrying(true);
    try {
      reset();
    } finally {
      setTimeout(() => setIsRetrying(false), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-violet-50/30 dark:from-slate-900 dark:to-violet-950/20 p-6">
      <div className="max-w-sm w-full animate-[fadeInUp_0.3s_ease-out_both]">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Authentication Error
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            Something went wrong during authentication. Please try again or return to sign in.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors"
            >
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </button>
            <Link
              href="/auth/signin"
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm transition-colors text-center"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
