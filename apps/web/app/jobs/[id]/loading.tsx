'use client';

import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface OrbitingIconProps {
  icon: LucideIcon;
  delay: number;
  radius: number;
}

function OrbitingIcon({ icon: Icon, delay, radius }: OrbitingIconProps) {
  return (
    <motion.div
      className="absolute"
      animate={{
        rotate: 360,
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'linear',
        delay,
      }}
      style={{
        width: radius * 2,
        height: radius * 2,
        left: `calc(50% - ${radius}px)`,
        top: `calc(50% - ${radius}px)`,
      }}
    >
      <div
        className="absolute w-10 h-10 rounded-xl bg-white shadow-lg border border-teal-100 flex items-center justify-center"
        style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
      >
        <Icon className="w-5 h-5 text-teal-600" />
      </div>
    </motion.div>
  );
}

export default function JobDetailsLoading() {
  const orbitingIcons: Array<{ icon: LucideIcon; delay: number }> = [
    { icon: Clock, delay: 0 },
    { icon: CheckCircle, delay: 2.67 },
    { icon: Eye, delay: 5.33 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        {/* Orbiting container */}
        <div className="relative w-48 h-48">
          {/* Orbit path */}
          <div className="absolute inset-4 rounded-full border-2 border-dashed border-teal-200 opacity-50" />

          {/* Main icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl flex items-center justify-center"
            >
              <FileText className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          {/* Orbiting icons */}
          {orbitingIcons.map(({ icon, delay }, index) => (
            <OrbitingIcon key={index} icon={icon} delay={delay} radius={80} />
          ))}
        </div>

        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            Loading Job Details
          </h2>
          <p className="mt-2 text-gray-500 flex items-center gap-1">
            Fetching job information
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
