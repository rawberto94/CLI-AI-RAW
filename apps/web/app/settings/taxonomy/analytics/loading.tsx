'use client';

import { motion } from 'framer-motion';
import { BarChart3, Tag, PieChart, TrendingUp, type LucideIcon } from 'lucide-react';

interface OrbitingIconProps {
  icon: LucideIcon;
  delay: number;
  radius: number;
  colorClass: string;
}

function OrbitingIcon({ icon: Icon, delay, radius, colorClass }: OrbitingIconProps) {
  return (
    <motion.div
      className="absolute"
      style={{
        width: radius * 2,
        height: radius * 2,
        left: `calc(50% - ${radius}px)`,
        top: `calc(50% - ${radius}px)`,
      }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'linear',
        delay,
      }}
    >
      <div
        className={`absolute w-10 h-10 rounded-xl ${colorClass} backdrop-blur-sm flex items-center justify-center shadow-lg`}
        style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
    </motion.div>
  );
}

export default function TaxonomyAnalyticsLoading() {
  const orbitingIcons: OrbitingIconProps[] = [
    { icon: Tag, delay: 0, radius: 80, colorClass: 'bg-indigo-500/90' },
    { icon: PieChart, delay: 2.67, radius: 80, colorClass: 'bg-purple-500/90' },
    { icon: TrendingUp, delay: 5.33, radius: 80, colorClass: 'bg-indigo-600/90' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <div className="relative w-48 h-48 flex items-center justify-center">
          {orbitingIcons.map((props, index) => (
            <OrbitingIcon key={index} {...props} />
          ))}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl"
          >
            <BarChart3 className="w-10 h-10 text-white" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
        >
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Loading Taxonomy Analytics
          </h2>
          <div className="mt-3 flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-indigo-500"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
