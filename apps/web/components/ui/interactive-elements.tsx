'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Info, HelpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string | number
  icon?: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  badge,
  icon,
  className
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className={cn("border border-gray-200 rounded-lg overflow-hidden", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-gray-600">{icon}</div>}
          <span className="font-medium text-gray-900">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      
      {isOpen && (
        <div className="p-4 bg-white border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}

interface TooltipProps {
  content: string | React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top',
  className 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={cn(
          "absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95 duration-200",
          positionClasses[position],
          className
        )}>
          {content}
          {/* Arrow */}
          <div className={cn(
            "absolute w-2 h-2 bg-gray-900 transform rotate-45",
            position === 'top' && "top-full left-1/2 -translate-x-1/2 -mt-1",
            position === 'bottom' && "bottom-full left-1/2 -translate-x-1/2 -mb-1",
            position === 'left' && "left-full top-1/2 -translate-y-1/2 -ml-1",
            position === 'right' && "right-full top-1/2 -translate-y-1/2 -mr-1"
          )} />
        </div>
      )}
    </div>
  )
}

interface InfoCalloutProps {
  type?: 'info' | 'warning' | 'success' | 'error'
  title?: string
  children: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

export function InfoCallout({
  type = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className
}: InfoCalloutProps) {
  const [isVisible, setIsVisible] = useState(true)
  
  if (!isVisible) return null
  
  const typeConfig = {
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      title: 'text-blue-900',
      text: 'text-blue-800'
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-600',
      title: 'text-yellow-900', 
      text: 'text-yellow-800'
    },
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: 'text-green-600',
      title: 'text-green-900',
      text: 'text-green-800'
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      title: 'text-red-900',
      text: 'text-red-800'
    }
  }
  
  const config = typeConfig[type]
  
  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }
  
  return (
    <div className={cn(
      "border rounded-lg p-4",
      config.bg,
      className
    )}>
      <div className="flex items-start gap-3">
        <Info className={cn("w-5 h-5 mt-0.5 flex-shrink-0", config.icon)} />
        <div className="flex-1">
          {title && (
            <h4 className={cn("font-medium mb-1", config.title)}>
              {title}
            </h4>
          )}
          <div className={cn("text-sm", config.text)}>
            {children}
          </div>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={cn("flex-shrink-0 p-1 hover:bg-black/5 rounded", config.icon)}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

interface QuickActionProps {
  icon: React.ReactNode
  label: string
  description?: string
  onClick: () => void
  variant?: 'default' | 'primary' | 'secondary'
  disabled?: boolean
  className?: string
}

export function QuickAction({
  icon,
  label,
  description,
  onClick,
  variant = 'default',
  disabled = false,
  className
}: QuickActionProps) {
  const variantClasses = {
    default: 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900',
    primary: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-900',
    secondary: 'bg-gray-50 hover:bg-gray-100 border-gray-300 text-gray-700'
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full p-4 border rounded-lg text-left transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]",
        variantClasses[variant],
        disabled && "opacity-50 cursor-not-allowed hover:scale-100",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-medium mb-1">{label}</div>
          {description && (
            <div className="text-sm opacity-75">{description}</div>
          )}
        </div>
      </div>
    </button>
  )
}

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'warning' | 'error' | 'processing'
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showPulse?: boolean
  className?: string
}

export function StatusIndicator({
  status,
  label,
  size = 'md',
  showPulse = false,
  className
}: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }
  
  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online' },
    offline: { color: 'bg-gray-400', label: 'Offline' },
    warning: { color: 'bg-yellow-500', label: 'Warning' },
    error: { color: 'bg-red-500', label: 'Error' },
    processing: { color: 'bg-blue-500', label: 'Processing' }
  }
  
  const config = statusConfig[status]
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <div className={cn(
          "rounded-full",
          config.color,
          sizeClasses[size]
        )} />
        {showPulse && (
          <div className={cn(
            "absolute inset-0 rounded-full animate-ping",
            config.color,
            "opacity-75"
          )} />
        )}
      </div>
      {label && (
        <span className="text-sm text-gray-600">
          {label || config.label}
        </span>
      )}
    </div>
  )
}

interface HelpButtonProps {
  content: string | React.ReactNode
  title?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function HelpButton({ 
  content, 
  title = "Help",
  size = 'md',
  className 
}: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5', 
    lg: 'w-6 h-6'
  }
  
  return (
    <Tooltip content={content} position="top">
      <button
        className={cn(
          "text-gray-400 hover:text-gray-600 transition-colors",
          className
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <HelpCircle className={sizeClasses[size]} />
      </button>
    </Tooltip>
  )
}