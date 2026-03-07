'use client';

/**
 * Welcome Tour Trigger Button
 * 
 * A floating button or inline component to trigger the welcome tour.
 * Can be placed anywhere in the app to allow users to restart the tour.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Play, Sparkles, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useWelcomeTourOptional, triggerWelcomeTour, triggerWelcomeModal } from './WelcomeTourProvider';
import Link from 'next/link';

// ============================================================================
// Inline Trigger Button
// ============================================================================

interface TourTriggerButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function TourTriggerButton({
  variant = 'outline',
  size = 'default',
  className,
  showLabel = true,
}: TourTriggerButtonProps) {
  const tour = useWelcomeTourOptional();

  const handleClick = () => {
    if (tour) {
      tour.resetTour();
      tour.startTour();
    } else {
      triggerWelcomeTour();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleClick}
            className={cn('gap-2', className)}
          >
            <Play className="w-4 h-4" />
            {showLabel && 'Take the Tour'}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Start the interactive tour</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Floating Help Button with Menu
// ============================================================================

interface FloatingHelpButtonProps {
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export function FloatingHelpButton({
  position = 'bottom-right',
  className,
}: FloatingHelpButtonProps) {
  const tour = useWelcomeTourOptional();

  const handleStartTour = () => {
    if (tour) {
      tour.resetTour();
      tour.startTour();
    } else {
      triggerWelcomeTour();
    }
  };

  const handleShowWelcome = () => {
    if (tour) {
      tour.openWelcomeModal();
    } else {
      triggerWelcomeModal();
    }
  };

  return (
    <div
      className={cn(
        'fixed z-50',
        position === 'bottom-right' ? 'bottom-6 right-6' : 'bottom-6 left-6',
        className
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full',
              'bg-gradient-to-br from-violet-500 to-purple-600',
              'text-white shadow-lg shadow-violet-500/30',
              'hover:shadow-xl hover:shadow-violet-500/40 transition-shadow',
              'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2'
            )}
            aria-label="Help menu"
          >
            <HelpCircle className="w-6 h-6" />
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={position === 'bottom-right' ? 'end' : 'start'} className="w-56">
          <DropdownMenuItem onClick={handleStartTour} className="gap-2 cursor-pointer">
            <Play className="w-4 h-4 text-violet-500" />
            <span>Start Tour</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShowWelcome} className="gap-2 cursor-pointer">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Welcome Screen</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/tour" className="gap-2 cursor-pointer">
              <GraduationCap className="w-4 h-4 text-violet-500" />
              <span>Learning Center</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings#shortcuts" className="gap-2 cursor-pointer">
              <span className="w-4 h-4 flex items-center justify-center text-slate-500 font-mono text-xs">⌘</span>
              <span>Keyboard Shortcuts</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// Sidebar Menu Item
// ============================================================================

interface TourMenuItemProps {
  collapsed?: boolean;
  className?: string;
}

export function TourMenuItem({ collapsed, className }: TourMenuItemProps) {
  const tour = useWelcomeTourOptional();

  const handleClick = () => {
    if (tour) {
      tour.resetTour();
      tour.startTour();
    } else {
      triggerWelcomeTour();
    }
  };

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg',
                'text-slate-600 hover:text-violet-600 hover:bg-violet-50',
                'dark:text-slate-400 dark:hover:text-violet-400 dark:hover:bg-violet-900/20',
                'transition-colors',
                className
              )}
            >
              <Play className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Start Tour</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2 rounded-lg',
        'text-slate-600 hover:text-violet-600 hover:bg-violet-50',
        'dark:text-slate-400 dark:hover:text-violet-400 dark:hover:bg-violet-900/20',
        'transition-colors text-sm font-medium',
        className
      )}
    >
      <Play className="w-5 h-5" />
      <span>Take the Tour</span>
    </button>
  );
}

// ============================================================================
// Combined Export
// ============================================================================

export function WelcomeTourTrigger(props: TourTriggerButtonProps) {
  return <TourTriggerButton {...props} />;
}

export default WelcomeTourTrigger;
