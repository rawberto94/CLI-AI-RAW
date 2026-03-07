'use client';

import React, {
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  forwardRef,
} from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';

// ============================================================================
// Hover Scale Effect
// ============================================================================

interface HoverScaleProps {
  children: ReactNode;
  scale?: number;
  className?: string;
  disabled?: boolean;
}

export const HoverScale = memo(function HoverScale({
  children,
  scale = 1.02,
  className = '',
  disabled = false,
}: HoverScaleProps) {
  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Press Effect (for buttons)
// ============================================================================

interface PressEffectProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const PressEffect = memo(function PressEffect({
  children,
  className = '',
  disabled = false,
  onClick,
}: PressEffectProps) {
  return (
    <motion.button
      className={className}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
});

// ============================================================================
// Ripple Effect
// ============================================================================

interface RippleEffectProps {
  children: ReactNode;
  className?: string;
  color?: string;
  duration?: number;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export const RippleEffect = memo(function RippleEffect({
  children,
  className = '',
  color = 'rgba(255, 255, 255, 0.3)',
  duration = 600,
}: RippleEffectProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  const addRipple = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple: Ripple = { id: nextId.current++, x, y, size };
      setRipples((prev) => [...prev, ripple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
      }, duration);
    },
    [duration]
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseDown={addRipple}
    >
      {children}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              backgroundColor: color,
            }}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration / 1000, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});

// ============================================================================
// Magnetic Effect (cursor follows)
// ============================================================================

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

export const Magnetic = memo(function Magnetic({
  children,
  className = '',
  strength = 0.3,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = (e.clientX - centerX) * strength;
      const y = (e.clientY - centerY) * strength;
      setPosition({ x, y });
    },
    [strength]
  );

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={position}
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Shake Effect (for errors)
// ============================================================================

interface ShakeEffectProps {
  children: ReactNode;
  trigger: boolean;
  className?: string;
  intensity?: number;
}

export const ShakeEffect = memo(function ShakeEffect({
  children,
  trigger,
  className = '',
  intensity = 10,
}: ShakeEffectProps) {
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <motion.div
      className={className}
      animate={
        isShaking
          ? {
              x: [0, -intensity, intensity, -intensity, intensity, 0],
            }
          : { x: 0 }
      }
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Bounce Effect
// ============================================================================

interface BounceEffectProps {
  children: ReactNode;
  trigger?: boolean;
  className?: string;
  direction?: 'up' | 'down';
}

export const BounceEffect = memo(function BounceEffect({
  children,
  trigger = false,
  className = '',
  direction = 'up',
}: BounceEffectProps) {
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  const yValues = direction === 'up' ? [0, -15, 0, -8, 0, -3, 0] : [0, 15, 0, 8, 0, 3, 0];

  return (
    <motion.div
      className={className}
      animate={isBouncing ? { y: yValues } : { y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Pulse Effect
// ============================================================================

interface PulseEffectProps {
  children: ReactNode;
  active?: boolean;
  className?: string;
  color?: string;
}

export const PulseEffect = memo(function PulseEffect({
  children,
  active = true,
  className = '',
  color = 'rgba(59, 130, 246, 0.5)',
}: PulseEffectProps) {
  if (!active) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      {children}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ backgroundColor: color }}
        animate={{
          scale: [1, 1.5, 1.5],
          opacity: [0.5, 0.2, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </div>
  );
});

// ============================================================================
// Glow Effect
// ============================================================================

interface GlowEffectProps {
  children: ReactNode;
  active?: boolean;
  className?: string;
  color?: string;
}

export const GlowEffect = memo(function GlowEffect({
  children,
  active = true,
  className = '',
  color = 'rgba(59, 130, 246, 0.6)',
}: GlowEffectProps) {
  return (
    <motion.div
      className={`relative ${className}`}
      animate={
        active
          ? {
              boxShadow: [
                `0 0 0 0 ${color}`,
                `0 0 20px 10px ${color}`,
                `0 0 0 0 ${color}`,
              ],
            }
          : {}
      }
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Tilt Effect (3D perspective)
// ============================================================================

interface TiltEffectProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  scale?: number;
}

export const TiltEffect = memo(function TiltEffect({
  children,
  className = '',
  maxTilt = 15,
  perspective = 1000,
  scale = 1.05,
}: TiltEffectProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0, scale: 1 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const percentX = (e.clientX - centerX) / (rect.width / 2);
      const percentY = (e.clientY - centerY) / (rect.height / 2);
      setTransform({
        rotateX: -percentY * maxTilt,
        rotateY: percentX * maxTilt,
        scale,
      });
    },
    [maxTilt, scale]
  );

  const handleMouseLeave = useCallback(() => {
    setTransform({ rotateX: 0, rotateY: 0, scale: 1 });
  }, []);

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective }}
      animate={{
        rotateX: transform.rotateX,
        rotateY: transform.rotateY,
        scale: transform.scale,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
});

// ============================================================================
// Count Up Animation
// ============================================================================

interface CountUpProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const CountUp = memo(function CountUp({
  value,
  duration = 1,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: CountUpProps) {
  const springValue = useSpring(0, { duration: duration * 1000 });
  const displayValue = useTransform(springValue, (v) => v.toFixed(decimals));
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    springValue.set(value);
    const unsubscribe = displayValue.on('change', (v) => setDisplay(v));
    return () => unsubscribe();
  }, [value, springValue, displayValue]);

  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
});

// ============================================================================
// Typing Effect
// ============================================================================

interface TypingEffectProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

export const TypingEffect = memo(function TypingEffect({
  text,
  speed = 50,
  delay = 0,
  className = '',
  onComplete,
}: TypingEffectProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);

    const timeout = setTimeout(() => {
      let index = 0;
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, speed, delay, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {isTyping && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-0.5 h-[1em] bg-current ml-0.5"
        />
      )}
    </span>
  );
});

// ============================================================================
// Success Check Animation
// ============================================================================

interface SuccessCheckProps {
  show: boolean;
  size?: number;
  className?: string;
}

export const SuccessCheck = memo(function SuccessCheck({
  show,
  size = 60,
  className = '',
}: SuccessCheckProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="show"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={className}
        >
          <svg width={size} height={size} viewBox="0 0 60 60">
            {/* Circle */}
            <motion.circle
              cx="30"
              cy="30"
              r="28"
              fill="none"
              stroke="#22c55e"
              strokeWidth="3"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            {/* Check mark */}
            <motion.path
              d="M18 30 L26 38 L42 22"
              fill="none"
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.4, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Confetti Effect
// ============================================================================

interface ConfettiProps {
  active: boolean;
  count?: number;
  colors?: string[];
}

export const Confetti = memo(function Confetti({
  active,
  count = 50,
  colors = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'],
}: ConfettiProps) {
  const confettiPieces = Array.from({ length: count }).map((_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 0.5,
    size: 6 + Math.random() * 6,
    rotation: Math.random() * 360,
  }));

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confettiPieces.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute"
              style={{
                left: piece.left,
                top: -20,
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
              initial={{ y: -20, rotate: 0, opacity: 1 }}
              animate={{
                y: '100vh',
                rotate: piece.rotation + 720,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random(),
                delay: piece.delay,
                ease: 'easeIn',
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Hover Highlight
// ============================================================================

interface HoverHighlightProps {
  children: ReactNode;
  className?: string;
  color?: string;
}

export const HoverHighlight = memo(function HoverHighlight({
  children,
  className = '',
  color = 'rgba(59, 130, 246, 0.1)',
}: HoverHighlightProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatePresence>
        {isHovered && (
          <motion.div key="hovered"
            className="absolute pointer-events-none"
            style={{
              left: mousePosition.x,
              top: mousePosition.y,
              width: 200,
              height: 200,
              x: '-50%',
              y: '-50%',
              background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
});
