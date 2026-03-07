/**
 * Loading Button Component
 * Button with integrated loading state and spinner
 */

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from './button';
import { cn } from '@/lib/utils';

export interface LoadingButtonProps extends ButtonProps {
  /** Whether button is in loading state */
  loading?: boolean;
  /** Text to show while loading */
  loadingText?: string;
  /** Icon to show (hidden during loading) */
  icon?: React.ReactNode;
  /** Icon position */
  iconPosition?: 'left' | 'right';
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      loading = false,
      loadingText,
      icon,
      iconPosition = 'left',
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const showLeftIcon = icon && iconPosition === 'left' && !loading;
    const showRightIcon = icon && iconPosition === 'right' && !loading;

    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'relative transition-all duration-200',
          loading && 'cursor-wait',
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {showLeftIcon && <span className="mr-2">{icon}</span>}
        {loading ? loadingText || children : children}
        {showRightIcon && <span className="ml-2">{icon}</span>}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';

/**
 * Icon Button with loading state
 */
export interface LoadingIconButtonProps extends ButtonProps {
  loading?: boolean;
  icon: React.ReactNode;
  label: string;
}

export const LoadingIconButton = React.forwardRef<HTMLButtonElement, LoadingIconButtonProps>(
  ({ loading = false, icon, label, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        size="icon"
        variant="ghost"
        aria-label={label}
        className={cn(
          'relative transition-all duration-200',
          loading && 'cursor-wait',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          icon
        )}
      </Button>
    );
  }
);

LoadingIconButton.displayName = 'LoadingIconButton';
