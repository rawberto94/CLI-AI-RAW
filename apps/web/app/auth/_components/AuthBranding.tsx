import * as React from "react";
import { motion } from "framer-motion";

export function AuthHeroArt({ className }: { className?: string }) {
  return (
    <div className={className ?? "relative mt-8 hidden xl:block"}>
      <div className="relative h-48 w-[26rem] max-w-full">
        {/* Glowing background effect */}
        <motion.div 
          className="absolute -inset-6 rounded-[2rem] bg-gradient-to-r from-cyan-400/20 via-purple-400/20 to-pink-400/20 blur-2xl"
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.05, 1]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="absolute inset-0 transform-gpu [transform:perspective(900px)_rotateY(-14deg)_rotateX(10deg)]">
          {/* Bottom card - cyan accent */}
          <motion.div 
            className="absolute left-8 top-8 h-36 w-64 rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-400/20 to-teal-400/20 shadow-2xl shadow-cyan-500/20 backdrop-blur-md"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
          
          {/* Middle card - purple accent */}
          <motion.div 
            className="absolute left-12 top-5 h-36 w-64 rounded-2xl border border-purple-300/30 bg-gradient-to-br from-purple-400/20 to-violet-400/20 shadow-2xl shadow-purple-500/20 backdrop-blur-md [transform:translateZ(14px)]"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
          />
          
          {/* Top card - main content */}
          <motion.div 
            className="absolute left-16 top-2 h-36 w-64 overflow-hidden rounded-2xl border border-white/40 bg-white/25 shadow-2xl shadow-black/25 backdrop-blur-md [transform:translateZ(28px)]"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Animated shimmer */}
            <motion.div 
              className="absolute -left-16 -top-10 h-40 w-64 rotate-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: [-100, 300] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
            />
            
            <div className="relative p-4">
              {/* Title bar with gradient */}
              <motion.div 
                className="h-3 w-36 rounded-full bg-gradient-to-r from-purple-400/80 via-pink-400/80 to-rose-400/80"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Content lines */}
              <div className="mt-3 h-2 w-48 rounded-full bg-white/40" />
              <div className="mt-2 h-2 w-36 rounded-full bg-white/30" />
              
              {/* Status indicator with pulsing dot */}
              <div className="mt-4 flex items-center gap-2">
                <motion.div 
                  className="h-6 w-6 rounded-lg bg-gradient-to-br from-emerald-400/50 to-teal-400/50 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <motion.div 
                    className="h-2 w-2 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                </motion.div>
                <div>
                  <div className="h-2 w-24 rounded-full bg-white/40" />
                  <div className="mt-1.5 h-1.5 w-16 rounded-full bg-white/30" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Animated pen with gradient */}
          <motion.div 
            className="absolute right-6 top-3 h-40 w-10 rotate-[22deg]"
            animate={{ 
              rotate: [22, 25, 22],
              y: [0, -3, 0]
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="absolute inset-0 rounded-xl border border-amber-300/30 bg-gradient-to-b from-amber-400/30 via-orange-400/30 to-rose-400/30 shadow-xl shadow-amber-500/20" />
            <div className="absolute left-1/2 top-3 h-3 w-5 -translate-x-1/2 rounded-md bg-white/30" />
            <div className="absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[9px] border-r-[9px] border-t-[14px] border-l-transparent border-r-transparent border-t-white/40" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function ConTigoLogo({ size = "lg" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: { height: 40, fontSize: 24 },
    md: { height: 56, fontSize: 32 },
    lg: { height: 72, fontSize: 40 },
    xl: { height: 96, fontSize: 52 },
  } as const;

  const s = sizes[size];

  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.svg 
        width={s.height} 
        height={s.height} 
        viewBox="0 0 100 100" 
        className="flex-shrink-0"
        whileHover={{ scale: 1.05, rotate: [0, -5, 5, 0] }}
        transition={{ duration: 0.4 }}
      >
        <defs>
          <linearGradient id="loginDocGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="loginPenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Document with gradient */}
        <rect x="10" y="5" width="55" height="70" rx="8" fill="url(#loginDocGradient)" filter="url(#glow)" />

        {/* Content lines */}
        <rect x="20" y="18" width="22" height="6" rx="3" fill="white" opacity="0.9" />
        <rect x="20" y="32" width="35" height="6" rx="3" fill="white" opacity="0.9" />
        <rect x="20" y="46" width="18" height="6" rx="3" fill="white" opacity="0.7" />

        {/* Pen with pink gradient */}
        <g transform="translate(55, 55) rotate(-45)">
          <rect x="-6" y="0" width="12" height="35" rx="2" fill="url(#loginPenGradient)" />
          <polygon points="-6,35 0,48 6,35" fill="url(#loginPenGradient)" />
          <rect x="-5" y="3" width="10" height="5" rx="1" fill="#DB2777" />
        </g>
      </motion.svg>
      <span className="font-bold tracking-tight" style={{ fontSize: s.fontSize }}>
        <span className="text-white">Con</span>
        <span className="text-purple-200">Tigo</span>
      </span>
    </motion.div>
  );
}
