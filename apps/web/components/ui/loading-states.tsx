'use client'

import React from 'react'
import { Loader2, Zap, Brain, Target, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'intelligence' | 'processing' | 'analysis'
  className?: string
}

export function LoadingSpinner({ 
  size = 'md', 
  variant = 'default',
  className 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }
  
  const variants = {
    default: {
      icon: Loader2,
      color: 'text-blue-600',
      animation: 'animate-spin'
    },
    intelligence: {
      icon: Brain,
      color: 'text-purple-600',
      animation: 'animate-pulse'
    },
    processing: {
      icon: Zap,
      color: 'text-yellow-600', 
      animation: 'animate-bounce'
    },
    analysis: {
      icon: Target,
      color: 'text-green-600',
      animation: 'animate-spin'
    }
  }
  
  const { icon: Icon, color, animation } = variants[variant]
  
  return (
    <Icon className={cn(
      sizeClasses[size],
      color,
      animation,
      className
    )} />
  )
}

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'card' | 'metric' | 'table'
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_2s_infinite]"
  
  const variantClasses = {
    text: "h-4 rounded",
    card: "h-32 rounded-lg",
    metric: "h-20 rounded-lg", 
    table: "h-8 rounded"
  }
  
  return (
    <div className={cn(
      baseClasses,
      variantClasses[variant],
      className
    )} />
  )
}

interface LoadingStateProps {
  title?: string
  message?: string
  description?: string
  details?: string
  variant?: 'default' | 'intelligence' | 'processing' | 'analysis'
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingState({ 
  title = "Loading...",
  message,
  description,
  details,
  variant = 'default',
  size = 'md'
}: LoadingStateProps) {
  const sizeClasses = {
    sm: { container: 'py-8', spinner: 'lg', title: 'text-lg', desc: 'text-sm' },
    md: { container: 'py-12', spinner: 'xl', title: 'text-xl', desc: 'text-base' },
    lg: { container: 'py-16', spinner: 'xl', title: 'text-2xl', desc: 'text-lg' }
  }
  
  const messages = {
    default: {
      title: "Loading Dashboard",
      description: "Preparing your data..."
    },
    intelligence: {
      title: "AI Analysis in Progress", 
      description: "Our AI is analyzing contracts and generating insights..."
    },
    processing: {
      title: "Processing Contracts",
      description: "Extracting data and running intelligence analysis..."
    },
    analysis: {
      title: "Generating Analytics",
      description: "Computing performance metrics and trends..."
    }
  }
  
  const variantMessage = messages[variant]
  const sizeConfig = sizeClasses[size]
  
  return (
    <div className={`text-center ${sizeConfig.container}`}>
      <div className="relative inline-flex items-center justify-center mb-4">
        {/* Outer ring */}
        <div className="absolute w-16 h-16 border-4 border-blue-200 rounded-full animate-ping opacity-20"></div>
        {/* Inner spinner */}
        <div className="relative">
          <LoadingSpinner 
            size={sizeConfig.spinner as any} 
            variant={variant}
          />
        </div>
      </div>
      
      <h3 className={`font-semibold text-gray-900 mb-2 ${sizeConfig.title}`}>
        {message || title || variantMessage.title}
      </h3>
      
      {(details || description || variantMessage.description) && (
        <p className={`text-gray-600 ${sizeConfig.desc}`}>
          {details || description || variantMessage.description}
        </p>
      )}
      
      {/* Progress dots */}
      <div className="flex justify-center gap-1 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  )
}

interface ProgressIndicatorProps {
  steps: Array<{
    label: string
    status: 'pending' | 'active' | 'completed'
  }>
  className?: string
}

export function ProgressIndicator({ steps, className }: ProgressIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
              step.status === 'completed' && "bg-green-500 text-white",
              step.status === 'active' && "bg-blue-500 text-white animate-pulse",
              step.status === 'pending' && "bg-gray-200 text-gray-500"
            )}>
              {step.status === 'completed' ? '✓' : index + 1}
            </div>
            <span className={cn(
              "text-xs mt-2 text-center max-w-20",
              step.status === 'active' && "text-blue-600 font-medium",
              step.status === 'completed' && "text-green-600",
              step.status === 'pending' && "text-gray-500"
            )}>
              {step.label}
            </span>
          </div>
          
          {index < steps.length - 1 && (
            <div className={cn(
              "flex-1 h-0.5 mx-4 transition-all duration-300",
              steps[index + 1].status !== 'pending' ? "bg-green-500" : "bg-gray-200"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}