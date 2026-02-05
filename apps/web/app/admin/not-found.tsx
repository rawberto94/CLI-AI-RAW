'use client';

import { motion } from 'framer-motion';
import { FileQuestion, ArrowLeft, Home, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg"
        >
          <FileQuestion className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Page Not Found
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          The admin page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="default" asChild className="gap-2">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              Admin Home
            </Link>
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t">
          <p className="text-sm text-muted-foreground mb-3">
            Looking for something specific?
          </p>
          <Button variant="ghost" size="sm" className="gap-2">
            <Search className="h-4 w-4" />
            Press ⌘K to search
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
