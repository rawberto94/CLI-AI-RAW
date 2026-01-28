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
      bg: "from-purple-500/80 via-violet-500/80 to-purple-500/80",
      border: "border-purple-300/50",
      shadow: "shadow-purple-500/40",
      lines: ["bg-white/80", "bg-white/60", "bg-white/40"],
    },
    accent: {
      bg: "from-fuchsia-400/80 via-pink-500/80 to-rose-500/80",
      border: "border-fuchsia-300/50",
      shadow: "shadow-fuchsia-500/40",
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
      initial={{ opacity: 0, y: 60, rotateX: -40, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        y: [0, -12, 2, -8, 0],
        x: [0, 3, -2, 1, 0],
        rotateX: [0, 4, -2, 3, 0],
        rotateY: [rotateY, rotateY + 5, rotateY - 2, rotateY + 3, rotateY],
        rotateZ: [0, 1, -1, 0.5, 0],
        scale: [1, 1.02, 0.98, 1.01, 1],
      }}
      transition={{ 
        opacity: { duration: 0.8, delay },
        y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 },
        x: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: delay + 0.3 },
        rotateX: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.3 },
        rotateY: { duration: 8, repeat: Infinity, ease: "easeInOut", delay: delay + 0.2 },
        rotateZ: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 },
        scale: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.6 },
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

          {/* Signature area - hidden 'raw' signature */}
          <motion.div 
            className="mt-4 pt-3 border-t border-white/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 1.2 }}
          >
            <motion.svg 
              viewBox="0 0 80 20" 
              className="w-16 h-4 text-white/70"
            >
              {/* Stylized 'raw' as signature flourish */}
              <motion.path 
                d="M3 14 C5 8, 8 6, 10 10 C11 12, 12 14, 14 10 M16 14 C18 6, 22 6, 24 10 C25 14, 28 14, 30 8 M32 14 L36 6 L38 12 L42 6 L44 14"
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.8 }}
                transition={{ duration: 2, delay: delay + 1.5, ease: "easeOut" }}
              />
              {/* Decorative tail */}
              <motion.path 
                d="M46 12 Q 55 8, 75 10"
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: delay + 2.5 }}
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

// 3D Floating Orb Component with enhanced dynamics
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
  const randomOffset = React.useMemo(() => Math.random() * 2, []);
  return (
    <motion.div
      className={`absolute rounded-full ${color}`}
      style={{ width: size, height: size, left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        y: [0, -25, 5, -15, 0],
        x: [0, 15, -8, 10, 0],
        scale: [1, 1.3, 0.9, 1.2, 1],
        opacity: [0.5, 0.9, 0.6, 0.85, 0.5],
        filter: ["blur(2px)", "blur(4px)", "blur(1px)", "blur(3px)", "blur(2px)"],
      }}
      transition={{
        duration: 5 + randomOffset,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
        times: [0, 0.25, 0.5, 0.75, 1],
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
          {([[12, 12], [36, 12], [12, 36], [36, 36]] as [number, number][]).map(([nx, ny], i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-purple-400"
              style={{ left: (nx ?? 0) - 4, top: (ny ?? 0) - 4 }}
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

// Data Flow Particles with enhanced dynamics
function DataParticles() {
  const colors = ["bg-purple-400", "bg-violet-400", "bg-fuchsia-400", "bg-violet-400", "bg-amber-400"];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => {
        const color = colors[i % colors.length];
        const size = 0.5 + Math.random() * 1.5;
        return (
          <motion.div
            key={i}
            className={`absolute rounded-full ${color}`}
            style={{
              left: `${5 + Math.random() * 90}%`,
              top: `${80 + Math.random() * 20}%`,
              width: `${size * 4}px`,
              height: `${size * 4}px`,
            }}
            animate={{
              y: [-20, -180 - Math.random() * 80],
              x: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 60],
              opacity: [0, 0.8, 0.6, 0],
              scale: [0.5, 1.2, 1, 0.3],
              rotate: [0, 180 + Math.random() * 180],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 4,
              ease: "easeOut",
            }}
          />
        );
      })}
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
    <div className={className ?? "relative hidden xl:block"}>
      <div className="relative h-56 xl:h-64 w-80 xl:w-96 mx-auto" style={{ perspective: "1200px" }}>
        {/* Ambient glow */}
        <motion.div 
          className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 blur-3xl"
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
        <FloatingOrb size={16} color="bg-violet-400/60" x={20} y={40} delay={0} />
        <FloatingOrb size={10} color="bg-purple-400/60" x={280} y={150} delay={0.5} />
        <FloatingOrb size={12} color="bg-fuchsia-400/60" x={240} y={15} delay={1} />
        <FloatingOrb size={8} color="bg-violet-400/60" x={60} y={170} delay={1.5} />
        
        {/* Main floating documents - centered layout */}
        <FloatingDocument 
          x={20} 
          y={40} 
          z={0}
          rotateY={-15}
          scale={0.75}
          variant="secondary"
          delay={0.2}
        />
        
        <FloatingDocument 
          x={110} 
          y={5} 
          z={40}
          rotateY={5}
          scale={0.9}
          variant="primary"
          delay={0}
        />
        
        <FloatingDocument 
          x={200} 
          y={55} 
          z={20}
          rotateY={15}
          scale={0.65}
          variant="accent"
          delay={0.4}
        />
        
        {/* AI Chip */}
        <AIChip x={250} y={0} />

        {/* Floating icons with enhanced dynamics */}
        <motion.div
          className="absolute -left-2 -top-2 w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-violet-500 shadow-lg shadow-violet-500/40 flex items-center justify-center"
          animate={{ 
            y: [0, -10, 3, -6, 0], 
            x: [0, 3, -2, 2, 0],
            rotate: [0, 10, -4, 6, 0],
            scale: [1, 1.06, 0.96, 1.03, 1],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute right-2 bottom-4 w-9 h-9 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 shadow-lg shadow-rose-500/40 flex items-center justify-center"
          animate={{ 
            y: [0, -14, 5, -8, 0], 
            x: [0, -5, 2, -3, 0],
            rotate: [0, -12, 5, -8, 0],
            scale: [1, 1.08, 0.94, 1.04, 1],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute left-12 bottom-0 w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/40 flex items-center justify-center"
          animate={{ 
            y: [0, -8, 2, -5, 0], 
            x: [0, 4, -2, 3, 0],
            rotate: [0, 12, -6, 8, 0],
            scale: [1, 1.12, 0.92, 1.06, 1],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

export function ConTigoLogo({ size = "lg" }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: { height: 36, fontSize: 24, barHeight: 6, gap: 9 },
    md: { height: 48, fontSize: 32, barHeight: 8, gap: 12 },
    lg: { height: 64, fontSize: 40, barHeight: 10, gap: 15 },
    xl: { height: 80, fontSize: 52, barHeight: 12, gap: 18 },
  } as const;

  const s = sizes[size];

  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* New Contigo Stacked Bars Logo */}
      <motion.svg 
        width={s.height} 
        height={s.height} 
        viewBox="0 0 48 48" 
        className="flex-shrink-0"
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.3 }}
      >
        <defs>
          <linearGradient id="barGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="barGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id="barGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#C4B5FD" />
          </linearGradient>
        </defs>
        {/* Three Stacked Bars */}
        <g transform="translate(8, 10)">
          <motion.rect 
            x="0" y="0" width="32" height="8" rx="4" 
            fill="url(#barGradient1)"
            initial={{ x: -40 }}
            animate={{ x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          />
          <motion.rect 
            x="0" y="12" width="32" height="8" rx="4" 
            fill="url(#barGradient2)"
            initial={{ x: -40 }}
            animate={{ x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          />
          <motion.rect 
            x="0" y="24" width="32" height="8" rx="4" 
            fill="url(#barGradient3)"
            initial={{ x: -40 }}
            animate={{ x: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          />
        </g>
      </motion.svg>
      <span className="font-bold tracking-tight" style={{ fontSize: s.fontSize }}>
        <span className="text-violet-300">con</span>
        <span className="text-white">tigo</span>
      </span>
    </motion.div>
  );
}
