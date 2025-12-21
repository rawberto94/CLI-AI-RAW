'use client';

import { motion } from 'framer-motion';
import { ShoppingCart, DollarSign, TrendingUp, Building2 } from 'lucide-react';

export default function ProcurementAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="relative">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-500 shadow-2xl shadow-emerald-500/30 flex items-center justify-center"
          >
            <ShoppingCart className="w-10 h-10 text-white" />
          </motion.div>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-1.5 bg-white rounded-full shadow-lg">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white rounded-full shadow-lg">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 p-1.5 bg-white rounded-full shadow-lg">
              <Building2 className="h-4 w-4 text-emerald-500" />
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <h2 className="text-xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
            Loading Procurement Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gathering procurement data and metrics...</p>

          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500"
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
