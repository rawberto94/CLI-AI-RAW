'use client';

import { motion } from 'framer-motion';
import { Settings, User, Shield, Bell, Zap, Globe } from 'lucide-react';

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <motion.div
            animate={{ 
              rotate: [0, 360],
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 flex items-center justify-center shadow-2xl shadow-slate-500/30"
          >
            <Settings className="w-10 h-10 text-white" />
          </motion.div>
          
          {/* Orbiting Icons */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50">
              <User className="h-4 w-4 text-violet-500" />
            </div>
          </motion.div>
          
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50">
              <Shield className="h-4 w-4 text-red-500" />
            </div>
          </motion.div>
          
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute top-1/2 -right-6 -translate-y-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50">
              <Bell className="h-4 w-4 text-amber-500" />
            </div>
          </motion.div>
          
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <div className="absolute top-1/2 -left-6 -translate-y-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50">
              <Zap className="h-4 w-4 text-violet-500" />
            </div>
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <h2 className="text-xl font-semibold bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-transparent">
            Loading Settings
          </h2>
          <p className="text-sm text-slate-500 mt-2">Fetching your preferences...</p>
        </motion.div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="w-2 h-2 rounded-full bg-gradient-to-r from-slate-500 to-slate-700"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
