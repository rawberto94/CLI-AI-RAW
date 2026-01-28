'use client';

/**
 * Enhanced Empty States & Feedback Components
 * Beautiful empty states, error states, and feedback displays
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Inbox, 
  Search, 
  FileX, 
  AlertTriangle, 
  WifiOff, 
  Lock, 
  RefreshCw,
  Plus,
  Upload,
  FolderOpen,
  Users,
  Calendar,
  MessageSquare,
  ShoppingCart,
  Bell,
  Heart,
  Bookmark,
  Zap,
  CheckCircle2,
  XCircle,
  Info,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Enhanced Empty State
// ============================================

interface EnhancedEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'card' | 'bordered';
  illustration?: React.ReactNode;
}

const sizeClasses = {
  sm: {
    container: 'py-8',
    icon: 'w-10 h-10',
    iconWrapper: 'w-14 h-14',
    title: 'text-base',
    description: 'text-sm',
    button: 'h-9 px-4 text-sm',
  },
  md: {
    container: 'py-12',
    icon: 'w-14 h-14',
    iconWrapper: 'w-20 h-20',
    title: 'text-lg',
    description: 'text-sm',
    button: 'h-10 px-5 text-sm',
  },
  lg: {
    container: 'py-16',
    icon: 'w-16 h-16',
    iconWrapper: 'w-24 h-24',
    title: 'text-xl',
    description: 'text-base',
    button: 'h-11 px-6 text-base',
  },
};

export function EnhancedEmptyState({
  icon = <Inbox />,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  variant = 'default',
  illustration,
}: EnhancedEmptyStateProps) {
  const sizeConfig = sizeClasses[size];

  const buttonVariants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800',
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizeConfig.container,
        variant === 'card' && 'p-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm',
        variant === 'bordered' && 'p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700'
      )}
    >
      {/* Illustration or Icon */}
      {illustration || (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className={cn(
            'flex items-center justify-center rounded-2xl mb-6',
            sizeConfig.iconWrapper,
            'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700',
            'text-slate-400 dark:text-slate-500'
          )}
        >
          <span className={sizeConfig.icon}>{icon}</span>
        </motion.div>
      )}

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn('font-semibold text-slate-900 dark:text-white mb-2', sizeConfig.title)}
      >
        {title}
      </motion.h3>

      {/* Description */}
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn('text-slate-500 dark:text-slate-400 max-w-md mb-6', sizeConfig.description)}
        >
          {description}
        </motion.p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-3"
        >
          {action && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={action.onClick}
              className={cn(
                'inline-flex items-center gap-2 font-medium rounded-xl transition-colors',
                sizeConfig.button,
                buttonVariants[action.variant || 'primary']
              )}
            >
              {action.icon}
              {action.label}
            </motion.button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors underline underline-offset-2"
            >
              {secondaryAction.label}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );

  if (variant === 'minimal') {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
      </div>
    );
  }

  return content;
}

// ============================================
// Pre-built Empty States
// ============================================

export function SearchNoResults({ query, onClear }: { query?: string; onClear?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={<Search />}
      title="No results found"
      description={query ? `We couldn't find anything matching "${query}". Try adjusting your search terms.` : 'Try adjusting your search or filters.'}
      action={onClear ? { label: 'Clear search', onClick: onClear, variant: 'secondary' } : undefined}
    />
  );
}

export function DataNotYetCreated({ itemName = 'items', onAdd }: { itemName?: string; onAdd?: () => void }) {
  const singularName = itemName.endsWith('s') ? itemName.slice(0, -1) : itemName;
  return (
    <EnhancedEmptyState
      icon={<FolderOpen />}
      title={`No ${itemName} yet`}
      description={`Get started by creating your first ${singularName}.`}
      action={onAdd ? { label: `Create ${singularName}`, onClick: onAdd, icon: <Plus className="w-4 h-4" /> } : undefined}
    />
  );
}

export function NotificationsEmpty() {
  return (
    <EnhancedEmptyState
      icon={<Bell />}
      title="All caught up!"
      description="You have no new notifications. We'll let you know when something happens."
      size="sm"
    />
  );
}

export function MessagesEmpty() {
  return (
    <EnhancedEmptyState
      icon={<MessageSquare />}
      title="No messages"
      description="Start a conversation to see your messages here."
    />
  );
}

export function FavoritesEmpty({ onBrowse }: { onBrowse?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={<Heart />}
      title="No favorites yet"
      description="Items you favorite will appear here for quick access."
      action={onBrowse ? { label: 'Browse items', onClick: onBrowse, variant: 'secondary' } : undefined}
    />
  );
}

export function BookmarksEmpty({ onBrowse }: { onBrowse?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={<Bookmark />}
      title="No bookmarks"
      description="Save items for later by bookmarking them."
      action={onBrowse ? { label: 'Start browsing', onClick: onBrowse, variant: 'secondary' } : undefined}
    />
  );
}

export function CartEmpty({ onShop }: { onShop?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={<ShoppingCart />}
      title="Your cart is empty"
      description="Looks like you haven't added anything to your cart yet."
      action={onShop ? { label: 'Continue shopping', onClick: onShop } : undefined}
    />
  );
}

export function TeamEmpty({ onInvite }: { onInvite?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={<Users />}
      title="No team members"
      description="Invite team members to collaborate on this project."
      action={onInvite ? { label: 'Invite members', onClick: onInvite, icon: <Plus className="w-4 h-4" /> } : undefined}
    />
  );
}

export function EventsEmpty({ onAdd }: { onAdd?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={<Calendar />}
      title="No upcoming events"
      description="Schedule events to see them on your calendar."
      action={onAdd ? { label: 'Add event', onClick: onAdd, icon: <Plus className="w-4 h-4" /> } : undefined}
    />
  );
}

export function FileUploadPrompt({ onUpload }: { onUpload?: () => void }) {
  return (
    <EnhancedEmptyState
      variant="bordered"
      icon={<Upload />}
      title="Upload files"
      description="Drag and drop files here, or click to browse your computer."
      action={onUpload ? { label: 'Choose files', onClick: onUpload, variant: 'outline' } : undefined}
    />
  );
}

// ============================================
// Enhanced Error State
// ============================================

interface EnhancedErrorStateProps {
  type?: 'generic' | 'not-found' | 'network' | 'permission' | 'server' | 'timeout';
  title?: string;
  description?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  size?: 'sm' | 'md' | 'lg';
  code?: string | number;
}

const errorConfig = {
  generic: {
    icon: <AlertTriangle />,
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-500',
  },
  'not-found': {
    icon: <FileX />,
    title: 'Not found',
    description: "The page or resource you're looking for doesn't exist or has been moved.",
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
  },
  network: {
    icon: <WifiOff />,
    title: 'Connection lost',
    description: "You appear to be offline. Check your internet connection and try again.",
    color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-500',
  },
  permission: {
    icon: <Lock />,
    title: 'Access denied',
    description: "You don't have permission to view this content. Contact your administrator if you think this is a mistake.",
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
  },
  server: {
    icon: <AlertCircle />,
    title: 'Server error',
    description: "We're having trouble connecting to our servers. Please try again later.",
    color: 'bg-red-100 dark:bg-red-900/30 text-red-500',
  },
  timeout: {
    icon: <RefreshCw />,
    title: 'Request timed out',
    description: 'The request took too long to complete. Please check your connection and try again.',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-500',
  },
};

export function EnhancedErrorState({
  type = 'generic',
  title,
  description,
  onRetry,
  onGoBack,
  size = 'md',
  code,
}: EnhancedErrorStateProps) {
  const config = errorConfig[type];
  const sizeConfig = sizeClasses[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center text-center', sizeConfig.container)}
    >
      {code && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-7xl font-bold text-slate-200 dark:text-slate-700 mb-4"
        >
          {code}
        </motion.div>
      )}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className={cn(
          'flex items-center justify-center rounded-2xl mb-6',
          sizeConfig.iconWrapper,
          config.color
        )}
      >
        <span className={sizeConfig.icon}>{config.icon}</span>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn('font-semibold text-slate-900 dark:text-white mb-2', sizeConfig.title)}
      >
        {title || config.title}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={cn('text-slate-500 dark:text-slate-400 max-w-md mb-6', sizeConfig.description)}
      >
        {description || config.description}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex items-center gap-3"
      >
        {onRetry && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRetry}
            className={cn(
              'inline-flex items-center gap-2 font-medium rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors',
              sizeConfig.button
            )}
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </motion.button>
        )}
        {onGoBack && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onGoBack}
            className={cn(
              'inline-flex items-center gap-2 font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors',
              sizeConfig.button
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// Enhanced Success State
// ============================================

interface EnhancedSuccessStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
  confetti?: boolean;
}

export function EnhancedSuccessState({
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  confetti = false,
}: EnhancedSuccessStateProps) {
  const sizeConfig = sizeClasses[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('relative flex flex-col items-center justify-center text-center', sizeConfig.container)}
    >
      {/* Success icon with animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        className={cn(
          'flex items-center justify-center rounded-full mb-6',
          sizeConfig.iconWrapper,
          'bg-violet-100 dark:bg-violet-900/30 text-violet-500'
        )}
      >
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.3 }}
        >
          <CheckCircle2 className={sizeConfig.icon} />
        </motion.div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn('font-semibold text-slate-900 dark:text-white mb-2', sizeConfig.title)}
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={cn('text-slate-500 dark:text-slate-400 max-w-md mb-6', sizeConfig.description)}
        >
          {description}
        </motion.p>
      )}

      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-3"
        >
          {action && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={action.onClick}
              className={cn(
                'inline-flex items-center gap-2 font-medium rounded-xl bg-violet-500 text-white hover:bg-violet-600 transition-colors',
                sizeConfig.button
              )}
            >
              {action.icon}
              {action.label}
            </motion.button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================
// Pro Feature Teaser
// ============================================

interface ProFeatureTeaserProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  features?: string[];
  onUpgrade?: () => void;
  onLearnMore?: () => void;
}

export function ProFeatureTeaser({
  icon = <Zap />,
  title,
  description,
  features = [],
  onUpgrade,
  onLearnMore,
}: ProFeatureTeaserProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-8"
    >
      {/* Decorative gradient orbs */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-400/20 rounded-full blur-3xl" />

      <div className="relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white mb-6 shadow-lg shadow-purple-500/30">
          <span className="w-8 h-8">{icon}</span>
        </div>

        <div className="inline-flex items-center gap-2 mb-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">
            Pro
          </span>
        </div>

        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">{description}</p>

        {features.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-3 mb-6">
            {features.map((feature, index) => (
              <li
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-800/60 text-sm text-slate-700 dark:text-slate-300"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                {feature}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-center gap-3">
          {onUpgrade && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onUpgrade}
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/30"
            >
              <Zap className="w-4 h-4" />
              Upgrade to Pro
            </motion.button>
          )}
          {onLearnMore && (
            <button
              onClick={onLearnMore}
              className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
            >
              Learn more
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Alert Banner
// ============================================

interface AlertBannerProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

const alertConfig = {
  info: {
    icon: Info,
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
    iconBg: 'bg-violet-100 dark:bg-violet-800',
    iconColor: 'text-violet-600 dark:text-violet-400',
    titleColor: 'text-violet-900 dark:text-violet-100',
    textColor: 'text-violet-700 dark:text-violet-300',
  },
  success: {
    icon: CheckCircle2,
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
    iconBg: 'bg-violet-100 dark:bg-violet-800',
    iconColor: 'text-violet-600 dark:text-violet-400',
    titleColor: 'text-violet-900 dark:text-violet-100',
    textColor: 'text-violet-700 dark:text-violet-300',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-100 dark:bg-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-900 dark:text-amber-100',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    iconBg: 'bg-red-100 dark:bg-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    titleColor: 'text-red-900 dark:text-red-100',
    textColor: 'text-red-700 dark:text-red-300',
  },
};

export function AlertBanner({
  type,
  title,
  message,
  dismissible = false,
  onDismiss,
  action,
  icon,
}: AlertBannerProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'flex items-start gap-4 p-4 rounded-xl border',
        config.bg,
        config.border
      )}
    >
      <div className={cn('flex-shrink-0 p-2 rounded-lg', config.iconBg)}>
        {icon || <Icon className={cn('w-5 h-5', config.iconColor)} />}
      </div>
      
      <div className="flex-1 min-w-0 py-0.5">
        {title && <p className={cn('font-semibold mb-1', config.titleColor)}>{title}</p>}
        <p className={cn('text-sm leading-relaxed', config.textColor)}>{message}</p>
        
        {action && (
          <button
            onClick={action.onClick}
            className={cn('mt-3 text-sm font-semibold underline underline-offset-2 hover:no-underline', config.titleColor)}
          >
            {action.label}
          </button>
        )}
      </div>

      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className={cn('flex-shrink-0 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors', config.iconColor)}
        >
          <XCircle className="w-5 h-5" />
        </button>
      )}
    </motion.div>
  );
}

export default {
  EnhancedEmptyState,
  SearchNoResults,
  DataNotYetCreated,
  NotificationsEmpty,
  MessagesEmpty,
  FavoritesEmpty,
  BookmarksEmpty,
  CartEmpty,
  TeamEmpty,
  EventsEmpty,
  FileUploadPrompt,
  EnhancedErrorState,
  EnhancedSuccessState,
  ProFeatureTeaser,
  AlertBanner,
};
