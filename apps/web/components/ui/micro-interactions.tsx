'use client';

/**
 * Micro-Interactions Library
 * Small delightful animations and feedback for common UI patterns
 */

import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { Check, Copy, Heart, ThumbsUp, Star, Bookmark, Share2, Bell, BellOff, Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Play, Pause, RotateCcw, RefreshCw, Trash2, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Toggle Switch with Animation
// ============================================

interface AnimatedToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'danger';
  disabled?: boolean;
  label?: string;
  description?: string;
}

const toggleSizes = {
  sm: { track: 'w-9 h-5', thumb: 'w-4 h-4', translate: 'translate-x-4' },
  md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
  lg: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
};

const toggleVariants = {
  default: 'bg-blue-500',
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
};

export function AnimatedToggle({
  checked = false,
  onChange,
  size = 'md',
  variant = 'default',
  disabled = false,
  label,
  description,
}: AnimatedToggleProps) {
  const sizeConfig = toggleSizes[size];

  return (
    <label className={cn('inline-flex items-start gap-3', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={cn(
          'relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
          sizeConfig.track,
          checked ? toggleVariants[variant] : 'bg-slate-200 dark:bg-slate-700'
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-lg ring-0',
            sizeConfig.thumb,
            'translate-x-0.5 my-auto',
            checked && sizeConfig.translate
          )}
        />
      </button>
      
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>}
          {description && <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
}

// ============================================
// Like Button with Particle Effect
// ============================================

interface LikeButtonProps {
  liked?: boolean;
  count?: number;
  onLike?: () => void;
  variant?: 'heart' | 'thumbs' | 'star';
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const likeIcons = {
  heart: Heart,
  thumbs: ThumbsUp,
  star: Star,
};

const likeSizes = {
  sm: { button: 'p-2', icon: 'w-4 h-4', text: 'text-xs' },
  md: { button: 'p-2.5', icon: 'w-5 h-5', text: 'text-sm' },
  lg: { button: 'p-3', icon: 'w-6 h-6', text: 'text-base' },
};

export function LikeButton({
  liked = false,
  count = 0,
  onLike,
  variant = 'heart',
  showCount = true,
  size = 'md',
}: LikeButtonProps) {
  const [particles, setParticles] = useState<number[]>([]);
  const Icon = likeIcons[variant];
  const sizeConfig = likeSizes[size];

  const handleClick = () => {
    if (!liked) {
      // Create particles
      const newParticles = Array.from({ length: 6 }, (_, i) => Date.now() + i);
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 700);
    }
    onLike?.();
  };

  const likeColors = {
    heart: { active: 'text-red-500 fill-red-500', inactive: 'text-slate-400 hover:text-red-400' },
    thumbs: { active: 'text-blue-500', inactive: 'text-slate-400 hover:text-blue-400' },
    star: { active: 'text-amber-500 fill-amber-500', inactive: 'text-slate-400 hover:text-amber-400' },
  };

  return (
    <div className="inline-flex items-center gap-1">
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={handleClick}
        className={cn(
          'relative rounded-full transition-colors',
          sizeConfig.button,
          'hover:bg-slate-100 dark:hover:bg-slate-800'
        )}
      >
        {/* Particles */}
        <AnimatePresence>
          {particles.map((id) => (
            <motion.span
              key={id}
              initial={{ scale: 0, opacity: 1 }}
              animate={{
                scale: [0, 1],
                opacity: [1, 0],
                x: Math.random() * 40 - 20,
                y: Math.random() * -30 - 10,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Icon className={cn(sizeConfig.icon, likeColors[variant].active)} style={{ transform: `scale(${0.5 + Math.random() * 0.5})` }} />
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Main icon */}
        <motion.div
          animate={liked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Icon className={cn(sizeConfig.icon, liked ? likeColors[variant].active : likeColors[variant].inactive)} />
        </motion.div>
      </motion.button>

      {showCount && (
        <AnimatePresence mode="wait">
          <motion.span
            key={count}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(sizeConfig.text, 'font-medium text-slate-600 dark:text-slate-400 min-w-[1.5rem]')}
          >
            {count}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  );
}

// ============================================
// Copy Button with Feedback
// ============================================

interface CopyFeedbackButtonProps {
  text: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal';
}

export function CopyFeedbackButton({
  text,
  label = 'Copy',
  size = 'md',
  variant = 'default',
}: CopyFeedbackButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  const sizeConfig = likeSizes[size];

  if (variant === 'minimal') {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleCopy}
        className={cn(sizeConfig.button, 'rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors')}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
            >
              <Check className={cn(sizeConfig.icon, 'text-emerald-500')} />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Copy className={cn(sizeConfig.icon, 'text-slate-400')} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-all',
        sizeConfig.button,
        sizeConfig.text,
        copied
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      )}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="copied"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2"
          >
            <Check className={sizeConfig.icon} />
            Copied!
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex items-center gap-2"
          >
            <Copy className={sizeConfig.icon} />
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================
// Animated Icon Toggle
// ============================================

interface IconToggleProps {
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  active?: boolean;
  onChange?: (active: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: { active: string; inactive: string };
}

export function IconToggle({
  activeIcon,
  inactiveIcon,
  active = false,
  onChange,
  activeColor = 'text-blue-500',
  inactiveColor = 'text-slate-400',
  size = 'md',
  tooltip,
}: IconToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const sizeConfig = likeSizes[size];

  return (
    <div className="relative inline-flex">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange?.(!active)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          sizeConfig.button,
          'rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
          active ? activeColor : inactiveColor
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active ? 'active' : 'inactive'}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={sizeConfig.icon}
          >
            {active ? activeIcon : inactiveIcon}
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {/* Tooltip */}
      {tooltip && (
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-700 rounded-lg whitespace-nowrap z-50"
            >
              {active ? tooltip.active : tooltip.inactive}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// ============================================
// Pre-built Icon Toggles
// ============================================

export function BookmarkToggle({ bookmarked = false, onChange }: { bookmarked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <IconToggle
      activeIcon={<Bookmark className="w-full h-full fill-current" />}
      inactiveIcon={<Bookmark className="w-full h-full" />}
      active={bookmarked}
      onChange={onChange}
      activeColor="text-blue-500"
      tooltip={{ active: 'Remove bookmark', inactive: 'Bookmark' }}
    />
  );
}

export function NotificationToggle({ enabled = true, onChange }: { enabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <IconToggle
      activeIcon={<Bell className="w-full h-full" />}
      inactiveIcon={<BellOff className="w-full h-full" />}
      active={enabled}
      onChange={onChange}
      activeColor="text-slate-900 dark:text-white"
      tooltip={{ active: 'Disable notifications', inactive: 'Enable notifications' }}
    />
  );
}

export function VisibilityToggle({ visible = true, onChange }: { visible?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <IconToggle
      activeIcon={<Eye className="w-full h-full" />}
      inactiveIcon={<EyeOff className="w-full h-full" />}
      active={visible}
      onChange={onChange}
      tooltip={{ active: 'Hide', inactive: 'Show' }}
    />
  );
}

export function LockToggle({ locked = false, onChange }: { locked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <IconToggle
      activeIcon={<Lock className="w-full h-full" />}
      inactiveIcon={<Unlock className="w-full h-full" />}
      active={locked}
      onChange={onChange}
      activeColor="text-amber-500"
      tooltip={{ active: 'Unlock', inactive: 'Lock' }}
    />
  );
}

export function MuteToggle({ muted = false, onChange }: { muted?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <IconToggle
      activeIcon={<VolumeX className="w-full h-full" />}
      inactiveIcon={<Volume2 className="w-full h-full" />}
      active={muted}
      onChange={onChange}
      activeColor="text-red-500"
      tooltip={{ active: 'Unmute', inactive: 'Mute' }}
    />
  );
}

export function PlayPauseToggle({ playing = false, onChange }: { playing?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <IconToggle
      activeIcon={<Pause className="w-full h-full" />}
      inactiveIcon={<Play className="w-full h-full" />}
      active={playing}
      onChange={onChange}
      tooltip={{ active: 'Pause', inactive: 'Play' }}
    />
  );
}

// ============================================
// Animated Progress Ring
// ============================================

interface ProgressRingProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  showValue?: boolean;
  animated?: boolean;
}

const ringSizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export function ProgressRing({
  progress,
  size = 'md',
  strokeWidth = 4,
  color = 'stroke-blue-500',
  trackColor = 'stroke-slate-200 dark:stroke-slate-700',
  showValue = true,
  animated = true,
}: ProgressRingProps) {
  const sizeValue = ringSizes[size];
  const radius = (sizeValue - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const springProgress = useSpring(0, { stiffness: 50, damping: 20 });
  const strokeDashoffset = useTransform(springProgress, (p) => circumference - (p / 100) * circumference);

  useEffect(() => {
    if (animated) {
      springProgress.set(progress);
    }
  }, [progress, animated, springProgress]);

  const offset = animated ? undefined : circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={sizeValue} height={sizeValue} className="-rotate-90">
        {/* Track */}
        <circle
          cx={sizeValue / 2}
          cy={sizeValue / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackColor}
        />
        {/* Progress */}
        <motion.circle
          cx={sizeValue / 2}
          cy={sizeValue / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={color}
          strokeDasharray={circumference}
          style={{ strokeDashoffset: animated ? strokeDashoffset : offset }}
        />
      </svg>
      {showValue && (
        <span className={cn(
          'absolute font-semibold text-slate-900 dark:text-white',
          size === 'sm' && 'text-[10px]',
          size === 'md' && 'text-xs',
          size === 'lg' && 'text-sm',
          size === 'xl' && 'text-lg'
        )}>
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
}

// ============================================
// Shake Animation Hook
// ============================================

export function useShake() {
  const [isShaking, setIsShaking] = useState(false);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  const shakeAnimation = isShaking
    ? {
        x: [0, -10, 10, -10, 10, -5, 5, -5, 5, 0],
        transition: { duration: 0.5 },
      }
    : {};

  return { isShaking, triggerShake, shakeAnimation };
}

// ============================================
// Confetti Burst
// ============================================

interface ConfettiProps {
  active: boolean;
  count?: number;
  colors?: string[];
  duration?: number;
}

export function Confetti({
  active,
  count = 30,
  colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'],
  duration = 1000,
}: ConfettiProps) {
  const [pieces, setPieces] = useState<Array<{ id: number; x: number; y: number; color: string; rotation: number }>>([]);

  useEffect(() => {
    if (active) {
      const newPieces = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 200 - 100,
        y: Math.random() * -200 - 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 720 - 360,
      }));
      setPieces(newPieces);
      setTimeout(() => setPieces([]), duration);
    }
  }, [active, count, colors, duration]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {pieces.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{ x: '50%', y: '50%', opacity: 1, scale: 1 }}
            animate={{
              x: `calc(50% + ${piece.x}px)`,
              y: `calc(50% + ${piece.y}px)`,
              opacity: 0,
              scale: 0,
              rotate: piece.rotation,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration / 1000, ease: 'easeOut' }}
            className="absolute w-2 h-2 rounded-sm"
            style={{ backgroundColor: piece.color }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Delete with Confirmation
// ============================================

interface DeleteButtonProps {
  onDelete: () => void;
  size?: 'sm' | 'md' | 'lg';
  requireConfirm?: boolean;
  confirmTimeout?: number;
}

export function DeleteButton({
  onDelete,
  size = 'md',
  requireConfirm = true,
  confirmTimeout = 3000,
}: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const sizeConfig = likeSizes[size];

  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => setConfirming(false), confirmTimeout);
      return () => clearTimeout(timer);
    }
  }, [confirming, confirmTimeout]);

  const handleClick = () => {
    if (!requireConfirm || confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-all',
        sizeConfig.button,
        sizeConfig.text,
        confirming
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
      )}
    >
      <AnimatePresence mode="wait">
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2"
          >
            <Trash2 className={sizeConfig.icon} />
            Click to confirm
          </motion.div>
        ) : (
          <motion.div
            key="delete"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <Trash2 className={sizeConfig.icon} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================
// Archive Button
// ============================================

interface ArchiveButtonProps {
  onArchive: () => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
}

export function ArchiveButton({ onArchive, size = 'md' }: ArchiveButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const sizeConfig = likeSizes[size];

  const handleClick = async () => {
    setState('loading');
    try {
      await onArchive();
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('idle');
    }
  };

  return (
    <motion.button
      whileHover={state === 'idle' ? { scale: 1.05 } : {}}
      whileTap={state === 'idle' ? { scale: 0.95 } : {}}
      onClick={handleClick}
      disabled={state !== 'idle'}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-all',
        sizeConfig.button,
        sizeConfig.text,
        state === 'done'
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
        state === 'loading' && 'opacity-50 cursor-wait'
      )}
    >
      <AnimatePresence mode="wait">
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <RefreshCw className={sizeConfig.icon} />
          </motion.div>
        )}
        {state === 'done' && (
          <motion.div
            key="done"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <Check className={sizeConfig.icon} />
          </motion.div>
        )}
        {state === 'idle' && (
          <motion.div key="idle">
            <Archive className={sizeConfig.icon} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================
// Undo Button with Timer
// ============================================

interface UndoButtonProps {
  onUndo: () => void;
  timeout?: number;
  label?: string;
}

export function UndoButton({ onUndo, timeout = 5000, label = 'Undo' }: UndoButtonProps) {
  const [timeLeft, setTimeLeft] = useState(timeout / 1000);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setVisible(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        onUndo();
        setVisible(false);
      }}
      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
    >
      <RotateCcw className="w-4 h-4" />
      {label} ({timeLeft}s)
    </motion.button>
  );
}

export default {
  AnimatedToggle,
  LikeButton,
  CopyFeedbackButton,
  IconToggle,
  BookmarkToggle,
  NotificationToggle,
  VisibilityToggle,
  LockToggle,
  MuteToggle,
  PlayPauseToggle,
  ProgressRing,
  useShake,
  Confetti,
  DeleteButton,
  ArchiveButton,
  UndoButton,
};
