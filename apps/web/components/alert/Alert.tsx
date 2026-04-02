'use client';

/**
 * Alert Banner Component
 * Contextual alerts and notifications banners
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  AlertTriangle,
  CheckCircle,
  Info,
  AlertCircle,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  type?: AlertType;
  title?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

interface BannerProps {
  children: React.ReactNode;
  type?: AlertType | 'promo';
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  sticky?: boolean;
}

// ============================================================================
// Config
// ============================================================================

const alertConfig: Record<AlertType, { icon: LucideIcon; colors: string; iconColor: string }> = {
  info: {
    icon: Info,
    colors: 'bg-violet-50 border-violet-200 text-violet-800',
    iconColor: 'text-violet-500',
  },
  success: {
    icon: CheckCircle,
    colors: 'bg-violet-50 border-violet-200 text-violet-800',
    iconColor: 'text-violet-500',
  },
  warning: {
    icon: AlertTriangle,
    colors: 'bg-amber-50 border-amber-200 text-amber-800',
    iconColor: 'text-amber-500',
  },
  error: {
    icon: AlertCircle,
    colors: 'bg-red-50 border-red-200 text-red-800',
    iconColor: 'text-red-500',
  },
};

// ============================================================================
// Alert Component
// ============================================================================

export function Alert({
  type = 'info',
  title,
  children,
  icon,
  dismissible = false,
  onDismiss,
  action,
  className,
}: AlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const config = alertConfig[type];
  const Icon = icon || config.icon;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div key="Alert-ap-1"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'flex gap-3 p-4 rounded-xl border',
            config.colors,
            className
          )}
          role="alert"
        >
          <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />

          <div className="flex-1 min-w-0">
            {title && (
              <h4 className="font-semibold mb-1">{title}</h4>
            )}
            <div className="text-sm opacity-90">{children}</div>

            {action && (
              <button
                onClick={action.onClick}
                className="mt-3 text-sm font-medium underline underline-offset-2 hover:no-underline"
              >
                {action.label}
              </button>
            )}
          </div>

          {dismissible && (
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Full-width Banner
// ============================================================================

export function Banner({
  children,
  type = 'info',
  dismissible = false,
  onDismiss,
  action,
  className,
  sticky = false,
}: BannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const bannerColors = {
    info: 'bg-violet-600 text-white',
    success: 'bg-violet-600 text-white',
    warning: 'bg-amber-500 text-white',
    error: 'bg-red-600 text-white',
    promo: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div key="Alert-ap-2"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            'px-4 py-3',
            bannerColors[type],
            sticky && 'sticky top-0 z-40',
            className
          )}
        >
          <div className="max-w-[1600px] mx-auto flex items-center justify-center gap-4">
            {type === 'promo' && (
              <Megaphone className="w-5 h-5 flex-shrink-0" />
            )}
            
            <p className="text-sm font-medium text-center">{children}</p>

            {action && (
              <button
                onClick={action.onClick}
                className="flex-shrink-0 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                {action.label}
              </button>
            )}

            {dismissible && (
              <button
                onClick={handleDismiss}
                className="absolute right-4 p-1 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Inline Alert (Compact)
// ============================================================================

interface InlineAlertProps {
  type?: AlertType;
  children: React.ReactNode;
  className?: string;
}

export function InlineAlert({ type = 'info', children, className }: InlineAlertProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-sm',
        className
      )}
    >
      <Icon className={cn('w-4 h-4', config.iconColor)} />
      <span className={cn(config.iconColor)}>{children}</span>
    </div>
  );
}

// ============================================================================
// Callout Box
// ============================================================================

interface CalloutProps {
  title?: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  type?: AlertType;
  className?: string;
}

export function Callout({
  title,
  children,
  icon,
  type = 'info',
  className,
}: CalloutProps) {
  const config = alertConfig[type];
  const Icon = icon || config.icon;

  return (
    <div
      className={cn(
        'relative pl-6 py-4 pr-4 border-l-4 rounded-r-xl',
        type === 'info' && 'bg-violet-50 border-violet-500',
        type === 'success' && 'bg-violet-50 border-violet-500',
        type === 'warning' && 'bg-amber-50 border-amber-500',
        type === 'error' && 'bg-red-50 border-red-500',
        className
      )}
    >
      <div className="absolute left-0 top-4 -translate-x-1/2 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
        <Icon className={cn('w-4 h-4', config.iconColor)} />
      </div>

      {title && (
        <h4 className="font-semibold text-slate-900 mb-1">{title}</h4>
      )}
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
