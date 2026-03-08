'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home,
  Bug,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function GlobalError({
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
      tags: { boundary: 'global-error' },
      extra: { digest: error.digest },
    });
  }, [error]);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      reset();
      setIsRetrying(false);
    }, 500);
  };

  return (
    <html>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/20 to-orange-50/20 dark:from-slate-900 dark:via-red-950/20 dark:to-orange-950/20">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div 
            className="max-w-lg w-full text-center animate-[fadeInUp_0.5s_ease-out_both]"
          >
            {/* Error Icon */}
            <div
              className="mb-6 inline-flex animate-[scaleIn_0.4s_ease-out_0.2s_both]"
            >
              <div className="p-4 bg-red-100 dark:bg-red-900/50 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
            </div>

            {/* Message */}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              Something went wrong
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
              Try refreshing the page or go back to the dashboard.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Button 
                onClick={handleRetry} 
                size="lg" 
                className="gap-2"
                disabled={isRetrying}
                aria-label={isRetrying ? "Retrying..." : "Try again"}
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2"
                onClick={() => window.location.href = '/'}
                aria-label="Go to dashboard"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                Go to Dashboard
              </Button>
            </div>

            {/* Error Details (collapsible) */}
            <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                aria-expanded={showDetails}
                aria-controls="error-details"
              >
                <span className="flex items-center gap-2">
                  <Bug className="w-4 h-4" aria-hidden="true" />
                  Technical Details
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
              
              {showDetails && (
                <div id="error-details" className="px-4 pb-4 text-left" role="region" aria-label="Error details">
                  <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg font-mono text-xs text-slate-600 dark:text-slate-400 overflow-auto max-h-40">
                    <p className="font-semibold text-red-600 dark:text-red-400 mb-2">{error.name}: {error.message}</p>
                    {error.digest && (
                      <p className="text-slate-500 dark:text-slate-500">Error ID: {error.digest}</p>
                    )}
                    {error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap text-slate-500 dark:text-slate-500">
                        {error.stack.split('\n').slice(0, 5).join('\n')}
                      </pre>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                    If this problem persists, please contact support with the error ID.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Inline keyframes — no external deps, guaranteed to work in error state */}
        <style>{`
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes scaleIn  { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        `}</style>
      </body>
    </html>
  );
}
