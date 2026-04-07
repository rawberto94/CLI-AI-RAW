'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';
import { 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft,
  Bug,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Report error to Sentry in production
    Sentry.captureException(error, {
      tags: { boundary: 'route-error' },
      extra: { digest: error.digest },
    });
  }, [error]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      reset();
    } finally {
      // Give a brief moment for the reset to process
      setTimeout(() => setIsRetrying(false), 1000);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-red-50/30 dark:from-slate-900 dark:to-red-950/20">
      <div 
        className="max-w-md w-full animate-[fadeInUp_0.4s_ease-out_both]"
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-8 text-center">
            <div
              className="animate-[scaleIn_0.3s_ease-out_0.1s_both]"
            >
              <div className="inline-flex p-3 bg-white/20 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-white" aria-hidden="true" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">
              Oops! Something went wrong
            </h1>
            <p className="text-red-100 text-sm">
              This section encountered an error
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-slate-600 dark:text-slate-400 text-center mb-6">
              Don&apos;t worry, the rest of the app is still working. 
              Try refreshing this section or go back.
            </p>

            {/* Actions */}
            <div className="flex gap-3 mb-4">
              <Button 
                onClick={handleRetry} 
                className="flex-1 gap-2"
                disabled={isRetrying}
                aria-label={isRetrying ? "Retrying..." : "Retry loading this section"}
              >
                {isRetrying ? (
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                )}
                {isRetrying ? 'Retrying...' : 'Retry'}
              </Button>
              <Button variant="outline" className="flex-1 gap-2" asChild>
                <Link href="/">
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  Dashboard
                </Link>
              </Button>
            </div>

            {/* Error Details (collapsible) */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                aria-expanded={showDetails}
                aria-controls="error-details"
              >
                <span className="flex items-center gap-2">
                  <Bug className="w-4 h-4" aria-hidden="true" />
                  View error details
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
              
              {showDetails && (
                <div id="error-details" className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800">
                  <div 
                    className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg font-mono text-xs text-slate-600 dark:text-slate-400 overflow-auto max-h-32"
                    role="region"
                    aria-label="Error details"
                  >
                    <p className="font-semibold text-red-600 dark:text-red-400">An unexpected error occurred</p>
                    {error.digest && (
                      <p className="text-slate-500 dark:text-slate-500 mt-1">ID: {error.digest}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Inline keyframes — no external deps, guaranteed to work in error state */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn  { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
