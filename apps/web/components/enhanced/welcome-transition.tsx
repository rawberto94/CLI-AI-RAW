"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  Rocket, 
  Star, 
  Zap, 
  Shield, 
  Check,
  ChevronRight,
  Globe,
  Cpu,
  Lock,
  BarChart3
} from "lucide-react";

// ============================================================================
// Animated Background Components
// ============================================================================

/** Cyber grid pattern with animated lines */
const CyberGrid = React.memo(function CyberGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Horizontal lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-violet-400" />
          </pattern>
          <linearGradient id="gridFade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="gridMask">
            <rect width="100%" height="100%" fill="url(#gridFade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
      </svg>

      {/* Animated scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent"
        initial={{ top: "0%" }}
        animate={{ top: "100%" }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
});

/** Floating orbs with glow effects */
const GlowingOrbs = React.memo(function GlowingOrbs() {
  const orbs = useMemo(() => [
    { size: 300, color: "from-violet-600/30 to-purple-600/30", delay: 0, duration: 8, x: "20%", y: "20%" },
    { size: 250, color: "from-violet-500/30 to-purple-500/30", delay: 1, duration: 10, x: "70%", y: "30%" },
    { size: 200, color: "from-fuchsia-500/30 to-pink-500/30", delay: 2, duration: 12, x: "40%", y: "70%" },
    { size: 180, color: "from-violet-500/20 to-violet-500/20", delay: 0.5, duration: 9, x: "80%", y: "80%" },
  ], []);

  return (
    <>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-3xl`}
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.7, 0.4],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
});

/** Particle constellation effect */
const ParticleConstellation = React.memo(function ParticleConstellation() {
  const particles = useMemo(() => 
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 2,
      duration: Math.random() * 3 + 2,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
});

/** Neon ring pulse effect */
const NeonRings = React.memo(function NeonRings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {[1, 2, 3].map((ring) => (
        <motion.div
          key={ring}
          className="absolute rounded-full border-2 border-violet-400/30"
          style={{
            width: 200 + ring * 150,
            height: 200 + ring * 150,
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 1.2, 0.8],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 4,
            delay: ring * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
});

// ============================================================================
// Main Welcome Transition Component
// ============================================================================

interface WelcomeTransitionProps {
  /** User's name or email to personalize greeting */
  userName?: string;
  /** URL to redirect to after animation */
  redirectUrl?: string;
  /** Duration of welcome animation in ms (default: 3500) */
  duration?: number;
  /** Callback when transition completes */
  onComplete?: () => void;
  /** Custom tagline under welcome message */
  tagline?: string;
}

const containerVariants: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 }
  },
  exit: { 
    opacity: 0,
    scale: 1.1,
    transition: { duration: 0.5, ease: "easeInOut" }
  }
};

const itemVariants: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", damping: 20, stiffness: 100 }
  }
};

const logoVariants: Variants = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: { type: "spring", damping: 15, stiffness: 100, delay: 0.2 }
  }
};

const features = [
  { icon: Shield, label: "Secure Access", color: "from-violet-400 to-violet-500" },
  { icon: BarChart3, label: "Analytics Ready", color: "from-violet-400 to-purple-500" },
  { icon: Cpu, label: "AI Powered", color: "from-violet-400 to-purple-500" },
  { icon: Globe, label: "Cloud Connected", color: "from-orange-400 to-red-500" },
];

export function WelcomeTransition({
  userName,
  redirectUrl = "/dashboard",
  duration = 3500,
  onComplete,
  tagline = "Your intelligent contract management platform",
}: WelcomeTransitionProps) {
  const router = useRouter();
  const [showFeatures, setShowFeatures] = useState(false);
  const [progress, setProgress] = useState(0);

  // Extract first name from full name or email
  const displayName = useMemo(() => {
    if (!userName) return "there";
    if (userName.includes("@")) {
      return userName.split("@")[0].split(".")[0];
    }
    return userName.split(" ")[0];
  }, [userName]);

  // Capitalize first letter
  const greeting = useMemo(() => {
    const name = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    return name;
  }, [displayName]);

  // Progress animation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, duration / 50);

    return () => clearInterval(interval);
  }, [duration]);

  // Show features after initial animation
  useEffect(() => {
    const timer = setTimeout(() => setShowFeatures(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Redirect after animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
      router.push(redirectUrl);
    }, duration);

    return () => clearTimeout(timer);
  }, [router, redirectUrl, duration, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/90 to-slate-950" />
      
      {/* Animated background effects */}
      <CyberGrid />
      <GlowingOrbs />
      <ParticleConstellation />
      <NeonRings />

      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto">
        {/* Logo/Icon */}
        <motion.div
          variants={logoVariants}
          className="relative mb-8"
        >
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/50">
            <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
          </div>
          
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-500 blur-xl opacity-50"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Success checkmark overlay */}
          <motion.div
            className="absolute -right-2 -bottom-2 w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.8, damping: 15 }}
          >
            <Check className="w-5 h-5 text-white" strokeWidth={3} />
          </motion.div>
        </motion.div>

        {/* Welcome text */}
        <motion.div variants={itemVariants} className="space-y-4 mb-8">
          <motion.h1 
            className="text-4xl sm:text-5xl md:text-6xl font-bold"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Welcome to ConTigo
          </motion.h1>
          
          <motion.p 
            className="text-xl sm:text-2xl text-violet-200/90 font-medium"
            variants={itemVariants}
          >
            Hello, <span className="text-white font-semibold">{greeting}</span>! 👋
          </motion.p>
          
          <motion.p 
            className="text-sm sm:text-base text-slate-400 max-w-md mx-auto"
            variants={itemVariants}
          >
            {tagline}
          </motion.p>
        </motion.div>

        {/* Feature icons */}
        <AnimatePresence>
          {showFeatures && (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {features.map((feature, idx) => (
                <motion.div
                  key={feature.label}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.1, duration: 0.3 }}
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg`}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs text-slate-300 font-medium">{feature.label}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <motion.div
          variants={itemVariants}
          className="w-full max-w-xs"
        >
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Rocket className="w-3 h-3" />
              Preparing your workspace...
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </motion.div>

        {/* Entering text */}
        <motion.div
          className="mt-8 flex items-center gap-2 text-slate-400 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.span
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ChevronRight className="w-4 h-4 text-violet-400" />
          </motion.span>
          <span>Taking you to your dashboard</span>
          <motion.div
            className="flex gap-0.5"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span>.</span>
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}>.</motion.span>
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}>.</motion.span>
          </motion.div>
        </motion.div>
      </div>

      {/* Corner decorations */}
      <motion.div
        className="absolute top-8 left-8 text-violet-400/20"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: 360 }}
        transition={{ duration: 2, delay: 0.5 }}
      >
        <Star className="w-8 h-8" fill="currentColor" />
      </motion.div>
      
      <motion.div
        className="absolute bottom-8 right-8 text-violet-400/20"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: -360 }}
        transition={{ duration: 2, delay: 0.7 }}
      >
        <Zap className="w-10 h-10" fill="currentColor" />
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Quick Welcome Flash (for faster transition)
// ============================================================================

interface QuickWelcomeProps {
  userName?: string;
  duration?: number;
  onComplete?: () => void;
}

export function QuickWelcome({ userName, duration = 1500, onComplete }: QuickWelcomeProps) {
  useEffect(() => {
    const timer = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const displayName = useMemo(() => {
    if (!userName) return "";
    if (userName.includes("@")) {
      return userName.split("@")[0].split(".")[0];
    }
    return userName.split(" ")[0];
  }, [userName]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <motion.div
          className="inline-block mb-4"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 1, ease: "easeInOut" }}
        >
          <Sparkles className="w-16 h-16 text-violet-400" />
        </motion.div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
          Welcome to ConTigo
        </h1>
        {displayName && (
          <p className="text-violet-300 text-lg">
            Hello, {displayName.charAt(0).toUpperCase() + displayName.slice(1)}!
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

export default WelcomeTransition;
