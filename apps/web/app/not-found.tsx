'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Search, 
  FileText, 
  ArrowLeft,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-violet-50/30 dark:from-slate-900 dark:via-violet-950/30 dark:to-violet-950/30 flex items-center justify-center p-6">
      <div 
        className="max-w-lg w-full text-center animate-[fadeInUp_0.5s_ease-out_both]"
      >
        {/* Animated 404 */}
        <div 
          className="mb-8 animate-[scaleIn_0.4s_ease-out_both]"
        >
          <div className="relative inline-block">
            <span className="text-[150px] font-black bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-none">
              404
            </span>
            <div
              className="absolute -top-4 -right-4 animate-[wiggle_2s_ease-in-out_infinite] motion-reduce:animate-none"
            >
              <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                <HelpCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          Page Not Found
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. 
          Let&apos;s get you back on track.
        </p>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="lg"
            className="gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go Back
          </Button>
          <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
            <Link href="/">
              <Home className="w-4 h-4" aria-hidden="true" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/contracts">
              <FileText className="w-4 h-4" aria-hidden="true" />
              View Contracts
            </Link>
          </Button>
        </div>

        {/* Helpful Links */}
        <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-6">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Popular destinations
          </h2>
          <nav className="grid grid-cols-2 gap-3" aria-label="Popular pages">
            <Link 
              href="/upload" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-sm text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Upload Contract
            </Link>
            <Link 
              href="/workflows" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-sm text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              Workflows
            </Link>
            <Link 
              href="/rate-cards" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-sm text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              Rate Cards
            </Link>
            <Link 
              href="/analytics" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-sm text-slate-600 dark:text-slate-400 hover:text-violet-700 dark:hover:text-violet-300"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Analytics
            </Link>
          </nav>
        </div>

        {/* Back button */}
        <button 
          onClick={() => window.history.back()}
          className="mt-6 text-sm text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors inline-flex items-center gap-1"
          aria-label="Go back to previous page"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Go back to previous page
        </button>
      </div>
      {/* Inline keyframes — no external deps */}
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn  { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes wiggle   { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(10deg); } 75% { transform: rotate(-10deg); } }
      `}</style>
    </div>
  );
}
