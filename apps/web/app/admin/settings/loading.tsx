'use client';

import { motion } from 'framer-motion';
import { Settings, Key, Webhook, Users, HardDrive, Download } from 'lucide-react';

export default function SettingsLoading() {
  const icons = [Key, Webhook, Users, HardDrive, Download];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30"
          >
            <Settings className="w-10 h-10 text-white" />
          </motion.div>
          
          {icons.slice(0, 4).map((Icon, i) => (
            <motion.div
              key={i}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 6 + i * 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0"
              style={{ transform: `rotate(${i * 90}deg)` }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50">
                <Icon className="h-4 w-4 text-indigo-500" />
              </div>
            </motion.div>
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Loading Admin Settings
          </h2>
          <p className="text-sm text-slate-500 mt-2">Preparing configuration...</p>
        </motion.div>

        <div className="flex items-center justify-center gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
