/**
 * Animated Button Component
 * Button with micro-interactions and loading states
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { animationConfig } from '@/lib/animations/config';

export interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function AnimatedButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: AnimatedButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
    outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500 disabled:border-gray-200 disabled:text-gray-400',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 disabled:text-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      transition={{
        duration: animationConfig.duration.fast,
        ease: animationConfig.easing.easeOut,
      }}
      disabled={isDisabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: animationConfig.duration.fast }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </motion.div>
      )}
      
      {!loading && icon && iconPosition === 'left' && (
        <motion.span
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: animationConfig.duration.fast }}
        >
          {icon}
        </motion.span>
      )}
      
      <span>{children}</span>
      
      {!loading && icon && iconPosition === 'right' && (
        <motion.span
          initial={{ opacity: 0, x: 5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: animationConfig.duration.fast }}
        >
          {icon}
        </motion.span>
      )}
    </motion.button>
  );
}

/**
 * Icon Button - for icon-only buttons
 */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  ...props
}: Omit<AnimatedButtonProps, 'children'> & { icon: React.ReactNode; label: string }) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{
        duration: animationConfig.duration.fast,
        ease: animationConfig.easing.easeOut,
      }}
      aria-label={label}
      title={label}
      className={`
        ${sizeClasses[size]}
        inline-flex items-center justify-center rounded-lg
        ${variant === 'ghost' ? 'hover:bg-gray-100' : ''}
        ${variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
      `}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

/**
 * Button Group - for grouped buttons
 */
export function ButtonGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex rounded-lg shadow-sm ${className}`} role="group">
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        
        const isFirst = index === 0;
        const isLast = index === React.Children.count(children) - 1;
        
        return React.cloneElement(child, {
          className: `
            ${child.props.className || ''}
            ${!isFirst ? '-ml-px' : ''}
            ${!isFirst && !isLast ? 'rounded-none' : ''}
            ${isFirst ? 'rounded-r-none' : ''}
            ${isLast ? 'rounded-l-none' : ''}
          `,
        } as any);
      })}
    </div>
  );
}
