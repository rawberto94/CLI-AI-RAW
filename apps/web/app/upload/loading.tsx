'use client';

import { motion } from 'framer-motion';
import { Upload, Loader2 } from 'lucide-react';

export default function UploadLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <Upload className="w-8 h-8 text-indigo-600" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="absolute -bottom-1 -right-1"
          >
            <Loader2 className="w-6 h-6 text-purple-600" />
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center"
        >
          <h2 className="text-lg font-semibold text-gray-900">Preparing Upload</h2>
          <p className="text-sm text-gray-500 mt-1">Setting up the upload zone...</p>
        </motion.div>
        
        {/* Upload zone skeleton */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 w-full max-w-xl"
        >
          <div className="h-64 border-2 border-dashed border-gray-200 rounded-xl bg-gradient-to-r from-gray-50 to-white animate-pulse flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto bg-gray-200 rounded-full mb-4" />
              <div className="h-4 bg-gray-200 rounded w-48 mx-auto mb-2" />
              <div className="h-3 bg-gray-200 rounded w-32 mx-auto" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
