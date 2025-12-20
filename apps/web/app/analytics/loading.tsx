'use client';

import { motion } from 'framer-motion';
import { BarChart3, Loader2 } from 'lucide-react';

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="absolute -bottom-1 -right-1"
          >
            <Loader2 className="w-6 h-6 text-pink-600" />
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center"
        >
          <h2 className="text-lg font-semibold text-gray-900">Loading Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Crunching the numbers...</p>
        </motion.div>
        
        {/* Chart skeleton */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 w-full max-w-2xl"
        >
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i}
                className="h-32 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
