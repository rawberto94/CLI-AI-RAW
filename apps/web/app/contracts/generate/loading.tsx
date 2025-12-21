'use client';

import { motion } from 'framer-motion';
import { Wand2, Sparkles, FileText, Zap } from 'lucide-react';

export default function ContractGeneratorLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center">
        {/* Main Icon with Orbiting Icons */}
        <div className="relative">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 shadow-2xl shadow-violet-500/30 flex items-center justify-center"
          >
            <Wand2 className="w-10 h-10 text-white" />
          </motion.div>
          
          {/* Orbiting Icons */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-1.5 bg-white rounded-full shadow-lg">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white rounded-full shadow-lg">
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 p-1.5 bg-white rounded-full shadow-lg">
              <Zap className="h-4 w-4 text-indigo-600" />
            </div>
          </motion.div>
        </div>
        
        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <h2 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Loading Contract Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Preparing AI generation tools...</p>
          
          {/* Loading Dots */}
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
