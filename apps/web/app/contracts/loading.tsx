'use client';

import { motion } from 'framer-motion';
import { FileText, Loader2 } from 'lucide-react';

export default function ContractsLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="absolute -bottom-1 -right-1"
          >
            <Loader2 className="w-6 h-6 text-indigo-600" />
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center"
        >
          <h2 className="text-lg font-semibold text-gray-900">Loading Contracts</h2>
          <p className="text-sm text-gray-500 mt-1">Fetching your contract data...</p>
        </motion.div>
        
        {/* Skeleton preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 w-full max-w-2xl space-y-3"
        >
          {[1, 2, 3].map((i) => (
            <div 
              key={i}
              className="h-20 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
