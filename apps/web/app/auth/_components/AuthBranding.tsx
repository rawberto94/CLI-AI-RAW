import * as React from "react";
import { motion } from "framer-motion";

// 3D Floating Document Component
function FloatingDocument({ 
  delay = 0, 
  x = 0, 
  y = 0, 
  z = 0,
  rotateY = 0,
  scale = 1,
  variant = "primary"
}: { 
  delay?: number; 
  x?: number; 
  y?: number; 
  z?: number;
  rotateY?: number;
  scale?: number;
  variant?: "primary" | "secondary" | "accent";
}) {
  const variants = {
    primary: {
      bg: "from-violet-500/90 via-purple-500/90 to-fuchsia-500/90",
      border: "border-violet-300/50",
      shadow: "shadow-violet-500/40",
      lines: ["bg-white/90", "bg-white/70", "bg-white/50"],
    },
    secondary: {
      bg: "from-cyan-500/80 via-teal-500/80 to-emerald-500/80",
      border: "border-cyan-300/50",
      shadow: "shadow-cyan-500/40",
      lines: ["bg-white/80", "bg-white/60", "bg-white/40"],
    },
    accent: {
      bg: "from-amber-400/80 via-orange-500/80 to-rose-500/80",
      border: "border-amber-300/50",
      shadow: "shadow-amber-500/40",
      lines: ["bg-white/80", "bg-white/60", "bg-white/40"],
    },
  };

  const v = variants[variant];

  return (
    <motion.div
      className="absolute"
      style={{ 
        left: x, 
        top: y,
        transformStyle: "preserve-3d",
      }}
      initial={{ opacity: 0, y: 50, rotateX: -30 }}
      animate={{ 
        opacity: 1, 
        y: [0, -8, 0],
        rotateX: [0, 2, 0],
        rotateY: [rotateY, rotateY + 3, rotateY],
      }}
      transition={{ 
        opacity: { duration: 0.6, delay },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 },
        rotateX: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.3 },
        rotateY: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: delay + 0.2 },
      }}
    >
      <div 
        className={`relative bg-gradient-to-br ${v.bg} rounded-xl ${v.border} border-2 shadow-2xl ${v.shadow} backdrop-blur-sm overflow-hidden`}
        style={{ 
          width: 140 * scale, 
          height: 180 * scale,
          transform: `perspective(1000px) rotateY(${rotateY}deg) translateZ(${z}px)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Document shine effect */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Scanning line effect */}
        <motion.div 
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          animate={{ top: ["-10%", "110%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: delay }}
        />

        {/* Document content */}
        <div className="relative p-3" style={{ transform: "translateZ(10px)" }}>
          {/* Header line */}
          <div className={`h-3 w-3/4 rounded-full ${v.lines[0]} mb-3`} />
          
          {/* Content lines */}
          <div className={`h-2 w-full rounded-full ${v.lines[1]} mb-2`} />
          <div className={`h-2 w-5/6 rounded-full ${v.lines[2]} mb-2`} />
          <div className={`h-2 w-4/5 rounded-full ${v.lines[1]} mb-4`} />
          
          {/* Checkbox items */}
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <motion.div 
                key={i} 
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: delay + 0.5 + i * 0.15 }}
              >
                <motion.div 
                  className="w-3 h-3 rounded border-2 border-white/70 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                >
                  {i < 2 && (
                    <motion.svg 
                      viewBox="0 0 12 12" 
                      className="w-2 h-2 text-white"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: delay + 0.8 + i * 0.2 }}
                    >
                      <motion.path 
                        d="M2 6l3 3 5-6" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </motion.svg>
                  )}
                </motion.div>
                <div className={`h-1.5 rounded-full ${v.lines[2]}`} style={{ width: `${60 + i * 10}%` }} />
              </motion.div>
            ))}
          </div>

          {/* Signature area */}
          <motion.div 
            className="mt-4 pt-3 border-t border-white/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 1.2 }}
          >
            <motion.svg 
              viewBox="0 0 80 20" 
              className="w-16 h-4 text-white/80"
            >
              <motion.path 
                d="M5 15 Q 20 5, 35 12 T 75 10"
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: delay + 1.5 }}
              />
            </motion.svg>
          </motion.div>
        </div>

        {/* Corner fold effect */}
        <div 
          className="absolute top-0 right-0 w-6 h-6"
          style={{ 
            background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%)",
          }}
        />
      </div>
    </motion.div>
  );
}

// 3D Floating Orb Component
function FloatingOrb({ 
  size, 
  color, 
  x, 
  y, 
  delay = 0 
}: { 
  size: number; 
  color: string; 
  x: number; 
  y: number; 
  delay?: number;
}) {
  return (
    <motion.div
      className={`absolute rounded-full ${color} blur-sm`}
      style={{ width: size, height: size, left: x, top: y }}
      animate={{
        y: [0, -20, 0],
        x: [0, 10, 0],
        scale: [1, 1.2, 1],
        opacity: [0.6, 0.9, 0.6],
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

// 3D AI Brain/Chip Component
function AIChip({ x, y }: { x: number; y: number }) {
  return (
    <motion.div
      className="absolute"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.8 }}
    >
      <motion.div 
        className="relative w-16 h-16"
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Main chip body */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-2xl shadow-purple-500/50">
          {/* Circuit lines */}
          <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 48 48">
            <motion.g stroke="rgba(255,255,255,0.6)" strokeWidth="1" fill="none">
              {/* Horizontal lines */}
              <motion.line x1="0" y1="12" x2="48" y2="12" 
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} 
                transition={{ duration: 1, delay: 1 }} />
              <motion.line x1="0" y1="24" x2="48" y2="24"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} 
                transition={{ duration: 1, delay: 1.2 }} />
              <motion.line x1="0" y1="36" x2="48" y2="36"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} 
                transition={{ duration: 1, delay: 1.4 }} />
              {/* Vertical lines */}
              <motion.line x1="12" y1="0" x2="12" y2="48"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} 
                transition={{ duration: 1, delay: 1.1 }} />
              <motion.line x1="24" y1="0" x2="24" y2="48"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} 
                transition={{ duration: 1, delay: 1.3 }} />
              <motion.line x1="36" y1="0" x2="36" y2="48"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} 
                transition={{ duration: 1, delay: 1.5 }} />
            </motion.g>
            {/* Glowing center */}
            <motion.circle 
              cx="24" cy="24" r="6" 
              fill="url(#chipGlow)"
              animate={{ r: [5, 7, 5], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <defs>
              <radialGradient id="chipGlow">
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>
          </svg>
          
          {/* Pulsing nodes */}
          {[[12, 12], [36, 12], [12, 36], [36, 36]].map(([nx, ny], i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-cyan-400"
              style={{ left: nx - 4, top: ny - 4 }}
              animate={{ 
                scale: [1, 1.5, 1], 
                opacity: [0.5, 1, 0.5],
                boxShadow: ["0 0 0px #22d3ee", "0 0 10px #22d3ee", "0 0 0px #22d3ee"]
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
        
        {/* Connection pins */}
        {[0, 1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            <motion.div 
              className="absolute w-1 h-3 bg-gradient-to-b from-gray-300 to-gray-400 rounded-full"
              style={{ left: 8 + i * 12, top: -6 }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
            />
            <motion.div 
              className="absolute w-1 h-3 bg-gradient-to-t from-gray-300 to-gray-400 rounded-full"
              style={{ left: 8 + i * 12, bottom: -6 }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          </React.Fragment>
        ))}
      </motion.div>
    </motion.div>
  );
}

// Data Flow Particles
function DataParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-400"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{
            y: [0, -100 - Math.random() * 100],
            x: [0, (Math.random() - 0.5) * 50],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// Connection Lines between documents
function ConnectionLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <defs>
        <linearGradient id="lineGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(139, 92, 246, 0.5)" />
          <stop offset="100%" stopColor="rgba(6, 182, 212, 0.5)" />
        </linearGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Animated connection lines */}
      <motion.path
        d="M 80 100 Q 160 50, 240 120"
        stroke="url(#lineGrad1)"
        strokeWidth="2"
        fill="none"
        filter="url(#glow2)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3] }}
        transition={{ 
          pathLength: { duration: 2, delay: 1 },
          opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }}
      />
      <motion.path
        d="M 240 120 Q 280 180, 320 140"
        stroke="url(#lineGrad1)"
        strokeWidth="2"
        fill="none"
        filter="url(#glow2)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3] }}
        transition={{ 
          pathLength: { duration: 2, delay: 1.5 },
          opacity: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }
        }}
      />
    </svg>
  );
}

export function AuthHeroArt({ className }: { className?: string }) {
  return (
    <div className={className ?? "relative mt-8 hidden xl:block"}>
      <div className="relative h-72 w-[28rem] max-w-full" style={{ perspective: "1200px" }}>
        {/* Ambient glow */}
        <motion.div 
          className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-cyan-500/20 to-fuchsia-500/20 blur-3xl"
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Connection lines */}
        <ConnectionLines />
        
        {/* Data flow particles */}
        <DataParticles />

        {/* Floating orbs */}
        <FloatingOrb size={20} color="bg-violet-400/60" x={20} y={40} delay={0} />
        <FloatingOrb size={14} color="bg-cyan-400/60" x={320} y={180} delay={0.5} />
        <FloatingOrb size={16} color="bg-fuchsia-400/60" x={280} y={30} delay={1} />
        <FloatingOrb size={12} color="bg-emerald-400/60" x={60} y={200} delay={1.5} />
        
        {/* Main floating documents - arranged in 3D space */}
        <FloatingDocument 
          x={10} 
          y={60} 
          z={0}
          rotateY={-15}
          scale={0.85}
          variant="secondary"
          delay={0.2}
        />
        
        <FloatingDocument 
          x={120} 
          y={20} 
          z={40}
          rotateY={5}
          scale={1}
          variant="primary"
          delay={0}
        />
        
        <FloatingDocument 
          x={230} 
          y={80} 
          z={20}
          rotateY={15}
          scale={0.75}
          variant="accent"
          delay={0.4}
        />
        
        {/* AI Chip */}
        <AIChip x={280} y={10} />

        {/* Floating icons */}
        <motion.div
          className="absolute left-4 top-4 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/40 flex items-center justify-center"
          animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute right-10 bottom-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 shadow-lg shadow-rose-500/40 flex items-center justify-center"
          animate={{ y: [0, -15, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute left-20 bottom-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/40 flex items-center justify-center"
          animate={{ y: [0, -8, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
        </motion.div>
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
