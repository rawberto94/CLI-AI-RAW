'use client';

import { motion } from 'framer-motion';
import { Scale, BarChart3, ArrowLeftRight, Target } from 'lucide-react';

const orbitingIcons = [
  { Icon: BarChart3, delay: 0 },
  { Icon: ArrowLeftRight, delay: 1 },
  { Icon: Target, delay: 2 },
];

export default function BenchmarkCompareLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        {/* Main icon with orbiting icons */}
        <div className="relative">
          {/* Central icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-2xl"
          >
            <Scale className="w-10 h-10 text-white" />
          </motion.div>

          {/* Orbiting icons */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            {orbitingIcons.map(({ Icon, delay }, index) => {
              const angle = (index * 360) / orbitingIcons.length;
              const radius = 52;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: delay * 0.15, duration: 0.3 }}
                  className="absolute w-8 h-8 rounded-lg bg-white shadow-lg flex items-center justify-center border border-violet-100"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                >
                  <Icon className="w-4 h-4 text-purple-600" />
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Title and loading text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <h2 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Loading Benchmark Comparison
          </h2>
          <p className="mt-2 text-sm text-slate-500 flex items-center gap-1">
            Preparing your comparison
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            >
              .
            </motion.span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
