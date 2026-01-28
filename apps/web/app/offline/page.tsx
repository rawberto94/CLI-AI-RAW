/**
 * Offline Page
 * Displayed when the user is offline and the requested page is not cached
 */

'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700">
            <WifiOff className="w-12 h-12 text-gray-500 dark:text-gray-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          You&apos;re Offline
        </h1>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          It looks like you&apos;ve lost your internet connection. Some features may be unavailable until you&apos;re back online.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>

        {/* Cached Features */}
        <div className="mt-12 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Available Offline
          </h2>
          <ul className="space-y-3 text-left text-gray-600 dark:text-gray-300">
            <li className="flex items-center gap-3">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Recently viewed contracts
            </li>
            <li className="flex items-center gap-3">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Cached dashboard data
            </li>
            <li className="flex items-center gap-3">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Your notification settings
            </li>
            <li className="flex items-center gap-3">
              <span className="w-2 h-2 bg-yellow-500 rounded-full" />
              Draft documents (will sync when online)
            </li>
          </ul>
        </div>

        {/* Status */}
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          We&apos;ll automatically reconnect when your connection is restored.
        </p>
      </div>
    </div>
  );
}
