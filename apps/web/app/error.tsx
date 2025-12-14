'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  RefreshCw, 
  ArrowLeft,
  Bug,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('[Route Error]', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 10, delay: 0.1 }}
            >
              <div className="inline-flex p-3 bg-white/20 rounded-full mb-4">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <h1 className="text-xl font-bold text-white mb-1">
              Oops! Something went wrong
            </h1>
            <p className="text-red-100 text-sm">
              This section encountered an error
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-slate-600 text-center mb-6">
              Don&apos;t worry, the rest of the app is still working. 
              Try refreshing this section or go back.
            </p>

            {/* Actions */}
            <div className="flex gap-3 mb-4">
              <Button onClick={reset} className="flex-1 gap-2">
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
              <Button variant="outline" className="flex-1 gap-2" asChild>
                <Link href="/">
                  <ArrowLeft className="w-4 h-4" />
                  Dashboard
                </Link>
              </Button>
            </div>

            {/* Error Details (collapsible) */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  View error details
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {showDetails && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg font-mono text-xs text-slate-600 overflow-auto max-h-32">
                    <p className="font-semibold text-red-600">{error.message}</p>
                    {error.digest && (
                      <p className="text-slate-500 mt-1">ID: {error.digest}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
