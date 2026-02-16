'use client';

import { motion } from 'framer-motion';
import { Shield, FileText, AlertTriangle } from 'lucide-react';

export default function EvidenceLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
        <div className="relative">
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} className="absolute inset-0">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md"><FileText className="h-4 w-4 text-indigo-500" /></div>
          </motion.div>
          <motion.div animate={{ rotate: -360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute inset-0">
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md"><AlertTriangle className="h-4 w-4 text-indigo-500" /></div>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 text-center">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent">Loading Evidence Vault</h2>
          <p className="text-sm text-muted-foreground mt-2">Securing your evidence data...</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
