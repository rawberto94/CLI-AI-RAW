'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home,
  Bug,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log error to monitoring service
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/20 to-orange-50/20">
        <div className="min-h-screen flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-lg w-full text-center"
          >
            {/* Error Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10, delay: 0.2 }}
              className="mb-6 inline-flex"
            >
              <div className="p-4 bg-red-100 rounded-full">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </motion.div>

            {/* Message */}
            <h1 className="text-2xl font-bold text-slate-900 mb-3">
              Something went wrong
            </h1>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
              Try refreshing the page or go back to the dashboard.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Button onClick={reset} size="lg" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2"
                onClick={() => window.location.href = '/'}
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Button>
            </div>

            {/* Error Details (collapsible) */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/50 overflow-hidden">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Technical Details
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {showDetails && (
                <div className="px-4 pb-4 text-left">
                  <div className="p-3 bg-slate-100 rounded-lg font-mono text-xs text-slate-600 overflow-auto max-h-40">
                    <p className="font-semibold text-red-600 mb-2">{error.name}: {error.message}</p>
                    {error.digest && (
                      <p className="text-slate-500">Error ID: {error.digest}</p>
                    )}
                    {error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap text-slate-500">
                        {error.stack.split('\n').slice(0, 5).join('\n')}
                      </pre>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    If this problem persists, please contact support with the error ID.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </body>
    </html>
  );
}
