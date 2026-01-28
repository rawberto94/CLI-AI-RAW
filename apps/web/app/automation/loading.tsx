'use client';

import { motion } from 'framer-motion';
import { Zap, Settings, Play, Repeat } from 'lucide-react';

export default function AutomationLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl shadow-yellow-500/30"
          >
            <Zap className="w-10 h-10 text-white" />
          </motion.div>
          
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50">
              <Settings className="h-4 w-4 text-violet-500" />
            </div>
          </motion.div>
          
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50">
              <Repeat className="h-4 w-4 text-violet-500" />
            </div>
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <h2 className="text-xl font-semibold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
            Loading Automation
          </h2>
          <p className="text-sm text-slate-500 mt-2">Preparing workflow automation...</p>
        </motion.div>

        <div className="flex items-center justify-center gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
