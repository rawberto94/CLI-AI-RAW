'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full text-center"
      >
        {/* Animated 404 */}
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            <span className="text-[150px] font-black bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-none">
              404
            </span>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute -top-4 -right-4"
            >
              <div className="p-3 bg-amber-100 rounded-full">
                <HelpCircle className="w-8 h-8 text-amber-600" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          Page Not Found
        </h1>
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. 
          Let&apos;s get you back on track.
        </p>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
            <Link href="/">
              <Home className="w-4 h-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href="/contracts">
              <FileText className="w-4 h-4" />
              View Contracts
            </Link>
          </Button>
        </div>

        {/* Helpful Links */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/50 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Popular destinations
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link 
              href="/upload" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-indigo-50 transition-colors text-sm text-slate-600 hover:text-indigo-700"
            >
              <RefreshCw className="w-4 h-4" />
              Upload Contract
            </Link>
            <Link 
              href="/workflows" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-indigo-50 transition-colors text-sm text-slate-600 hover:text-indigo-700"
            >
              <FileText className="w-4 h-4" />
              Workflows
            </Link>
            <Link 
              href="/rate-cards" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-indigo-50 transition-colors text-sm text-slate-600 hover:text-indigo-700"
            >
              <Search className="w-4 h-4" />
              Rate Cards
            </Link>
            <Link 
              href="/analytics" 
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-indigo-50 transition-colors text-sm text-slate-600 hover:text-indigo-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Analytics
            </Link>
          </div>
        </div>

        {/* Back button */}
        <button 
          onClick={() => window.history.back()}
          className="mt-6 text-sm text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back to previous page
        </button>
      </motion.div>
    </div>
  );
}
