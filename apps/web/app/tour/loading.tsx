'use client';

import { motion } from 'framer-motion';
import { Sparkles, PlayCircle, GraduationCap, BookOpen } from 'lucide-react';

export default function TourLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Animated Logo */}
        <div className="relative mb-8">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            }}
            className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-2xl shadow-purple-500/30"
          >
            <Sparkles className="h-10 w-10 text-white" />
          </motion.div>
          
          {/* Orbiting Icons */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <motion.div
              className="absolute -top-4 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50"
            >
              <PlayCircle className="h-4 w-4 text-violet-500" />
            </motion.div>
          </motion.div>
          
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <motion.div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50"
            >
              <GraduationCap className="h-4 w-4 text-indigo-500" />
            </motion.div>
          </motion.div>
          
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <motion.div
              className="absolute top-1/2 -right-8 -translate-y-1/2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md dark:shadow-slate-900/50"
            >
              <BookOpen className="h-4 w-4 text-purple-500" />
            </motion.div>
          </motion.div>
        </div>

        {/* Loading Text */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent"
        >
          Loading Tour
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-slate-500 mt-2 text-sm"
        >
          Preparing your learning experience...
        </motion.p>

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
              className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
