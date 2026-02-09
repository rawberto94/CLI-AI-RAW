'use client';

import { motion } from 'framer-motion';
import { FileStack, Upload, Copy, CheckCircle } from 'lucide-react';

const orbitingIcons = [
  { Icon: Upload, delay: 0 },
  { Icon: Copy, delay: 1 },
  { Icon: CheckCircle, delay: 2 },
];

export default function TemplateImportLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        {/* Main icon container with orbiting icons */}
        <div className="relative w-32 h-32">
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl">
              <FileStack className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Orbiting icons */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            {orbitingIcons.map(({ Icon, delay }, index) => {
              const angle = (index * 120 - 90) * (Math.PI / 180);
              const radius = 52;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: delay * 0.2, duration: 0.3 }}
                  className="absolute w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center border border-indigo-100"
                  style={{
                    left: `calc(50% + ${x}px - 16px)`,
                    top: `calc(50% + ${y}px - 16px)`,
                  }}
                >
                  <Icon className="w-4 h-4 text-violet-600" />
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
          className="mt-8 text-center"
        >
          <h2 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Loading Template Import
          </h2>
          <p className="mt-2 text-sm text-gray-500 flex items-center justify-center gap-1">
            Preparing your content
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.5, 1] }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.5, 1], delay: 0.2 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.5, 1], delay: 0.4 }}
            >
              .
            </motion.span>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
