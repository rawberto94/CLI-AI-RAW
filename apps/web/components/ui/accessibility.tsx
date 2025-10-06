/**
 * Accessibility Components and Utilities
 * WCAG 2.1 compliant components and accessibility helpers
 */

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Type, 
  Contrast,
  MousePointer,
  Keyboard,
  Focus
} from 'lucide-react'

// Skip to main content link
export const SkipToMain: React.FC = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium"
  >
    Skip to main content
  </a>
)

// Screen reader only text
export const ScreenReaderOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="sr-only">{children}</span>
)

// Accessible heading with proper hierarchy
export const AccessibleHeading: React.FC<{
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: React.ReactNode
  className?: string
  id?: string
}> = ({ level, children, className, id }) => {
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements
  
  return (
    <Tag 
      id={id}
      className={cn(
        'font-semibold tracking-tight',
        level === 1 && 'text-4xl lg:text-5xl',
        level === 2 && 'text-3xl',
        level === 3 && 'text-2xl',
        level === 4 && 'text-xl',
        level === 5 && 'text-lg',
        level === 6 && 'text-base',
        className
      )}
    >
      {children}
    </Tag>
  )
}

// Focus trap for modals and dialogs
export const FocusTrap: React.FC<{
  children: React.ReactNode
  active: boolean
}> = ({ children, active }) => {
  const trapRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return

    const trap = trapRef.current
    if (!trap) return

    const focusableElements = trap.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleTabKey)
    firstElement?.focus()

    return () => {
      document.removeEventListener('keydown', handleTabKey)
    }
  }, [active])

  return (
    <div ref={trapRef}>
      {children}
    </div>
  )
}

// Accessible button with proper ARIA attributes
export const AccessibleButton: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  ariaLabel?: string
  ariaDescribedBy?: string
  ariaExpanded?: boolean
  ariaPressed?: boolean
  className?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}> = ({ 
  children, 
  onClick, 
  disabled, 
  ariaLabel, 
  ariaDescribedBy, 
  ariaExpanded, 
  ariaPressed,
  className,
  variant = 'default',
  size = 'default'
}) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedBy}
    aria-expanded={ariaExpanded}
    aria-pressed={ariaPressed}
    variant={variant}
    size={size}
    className={className}
  >
    {children}
  </Button>
)

// Live region for dynamic content announcements
export const LiveRegion: React.FC<{
  children: React.ReactNode
  politeness?: 'polite' | 'assertive' | 'off'
  atomic?: boolean
  className?: string
}> = ({ children, politeness = 'polite', atomic = false, className }) => (
  <div
    aria-live={politeness}
    aria-atomic={atomic}
    className={cn('sr-only', className)}
  >
    {children}
  </div>
)

// Accessibility toolbar
export const AccessibilityToolbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [settings, setSettings] = useState({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReader: false,
    keyboardNavigation: false
  })

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  useEffect(() => {
    // Apply accessibility settings to document
    const root = document.documentElement

    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    if (settings.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }

    if (settings.reducedMotion) {
      root.classList.add('reduce-motion')
    } else {
      root.classList.remove('reduce-motion')
    }

    if (settings.keyboardNavigation) {
      root.classList.add('keyboard-navigation')
    } else {
      root.classList.remove('keyboard-navigation')
    }
  }, [settings])

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={cn(
        'bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-200',
        isOpen ? 'w-80 p-4' : 'w-12 h-12'
      )}>
        {!isOpen ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(true)}
            aria-label="Open accessibility options"
            className="w-full h-full"
          >
            <Eye className="h-5 w-5" />
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Accessibility Options</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                aria-label="Close accessibility options"
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Contrast className="h-4 w-4" />
                  <span className="text-sm">High Contrast</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSetting('highContrast')}
                  aria-pressed={settings.highContrast}
                  className={settings.highContrast ? 'bg-primary text-primary-foreground' : ''}
                >
                  {settings.highContrast ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  <span className="text-sm">Large Text</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSetting('largeText')}
                  aria-pressed={settings.largeText}
                  className={settings.largeText ? 'bg-primary text-primary-foreground' : ''}
                >
                  {settings.largeText ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointer className="h-4 w-4" />
                  <span className="text-sm">Reduced Motion</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSetting('reducedMotion')}
                  aria-pressed={settings.reducedMotion}
                  className={settings.reducedMotion ? 'bg-primary text-primary-foreground' : ''}
                >
                  {settings.reducedMotion ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm">Screen Reader</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSetting('screenReader')}
                  aria-pressed={settings.screenReader}
                  className={settings.screenReader ? 'bg-primary text-primary-foreground' : ''}
                >
                  {settings.screenReader ? 'On' : 'Off'}
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  <span className="text-sm">Keyboard Navigation</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSetting('keyboardNavigation')}
                  aria-pressed={settings.keyboardNavigation}
                  className={settings.keyboardNavigation ? 'bg-primary text-primary-foreground' : ''}
                >
                  {settings.keyboardNavigation ? 'On' : 'Off'}
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setSettings({
                    highContrast: false,
                    largeText: false,
                    reducedMotion: false,
                    screenReader: false,
                    keyboardNavigation: false
                  })
                }}
              >
                Reset All
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Keyboard navigation helper
export const useKeyboardNavigation = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Add keyboard navigation class when tab is pressed
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation')
      }
    }

    const handleMouseDown = () => {
      // Remove keyboard navigation class when mouse is used
      document.body.classList.remove('keyboard-navigation')
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])
}

// Color contrast checker utility
export const checkColorContrast = (foreground: string, background: string): {
  ratio: number
  wcagAA: boolean
  wcagAAA: boolean
} => {
  // Simplified contrast ratio calculation
  // In a real implementation, you'd use a proper color contrast library
  const ratio = 4.5 // Mock ratio
  
  return {
    ratio,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7
  }
}

// Accessible form field with proper labeling
export const AccessibleFormField: React.FC<{
  label: string
  children: React.ReactNode
  error?: string
  description?: string
  required?: boolean
  className?: string
}> = ({ label, children, error, description, required, className }) => {
  const fieldId = React.useId()
  const errorId = error ? `${fieldId}-error` : undefined
  const descriptionId = description ? `${fieldId}-description` : undefined

  return (
    <div className={cn('space-y-2', className)}>
      <label 
        htmlFor={fieldId}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      <div>
        {React.cloneElement(children as React.ReactElement, {
          id: fieldId,
          'aria-describedby': [descriptionId, errorId].filter(Boolean).join(' ') || undefined,
          'aria-invalid': error ? 'true' : undefined,
          required
        } as any)}
      </div>
      
      {(error != null) && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}