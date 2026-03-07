/**
 * Accessible Components
 * WCAG 2.1 Level AA compliant components
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { useFocusTrap, useAnnouncer, usePrefersReducedMotion } from '@/hooks/useAccessibility';
import { motion } from 'framer-motion';
import { X, ChevronDown, Check as _Check } from 'lucide-react';

// ============================================================================
// Skip Links
// ============================================================================

export function SkipLinks() {
  return (
    <div className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-violet-600 focus:text-white">
      <a href="#main-content" className="focus:outline-none focus:ring-2 focus:ring-white">
        Skip to main content
      </a>
      <span className="mx-2">|</span>
      <a href="#navigation" className="focus:outline-none focus:ring-2 focus:ring-white">
        Skip to navigation
      </a>
    </div>
  );
}

// ============================================================================
// Accessible Modal
// ============================================================================

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  description?: string;
}

export function AccessibleModal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  description 
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { announce } = useAnnouncer();

  useFocusTrap(isOpen);

  useEffect(() => {
    if (isOpen) {
      announce(`${title} dialog opened`);
    }
  }, [isOpen, title, announce]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
        announce('Dialog closed');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, announce]);

  if (!isOpen) return null;

  const MotionDiv = prefersReducedMotion ? 'div' : motion.div;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <MotionDiv
        ref={modalRef}
        {...(!prefersReducedMotion && {
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.95 },
        })}
        className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 id="modal-title" className="text-xl font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {description && (
            <p id="modal-description" className="text-gray-600 mb-4">
              {description}
            </p>
          )}
          {children}
        </div>
      </MotionDiv>
    </div>
  );
}

// ============================================================================
// Accessible Button
// ============================================================================

export interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

export function AccessibleButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  ariaLabel,
  children,
  disabled,
  className = '',
  ...props
}: AccessibleButtonProps) {
  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {loading && (
        <span className="animate-spin" aria-hidden="true">
          ⏳
        </span>
      )}
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}

// ============================================================================
// Accessible Form Field
// ============================================================================

export interface AccessibleFormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function AccessibleFormField({
  id,
  label,
  error,
  hint,
  required,
  children,
}: AccessibleFormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && (
          <span className="text-red-600 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-sm text-gray-600">
          {hint}
        </p>
      )}

      {React.cloneElement(children as React.ReactElement, {
        id,
        'aria-describedby': [
          hint ? hintId : null,
          error ? errorId : null,
        ].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? 'true' : undefined,
        'aria-required': required,
      } as any)}

      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Accessible Accordion
// ============================================================================

export interface AccordionItemProps {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccessibleAccordion({ items }: { items: AccordionItemProps[] }) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(
    new Set(items.filter(item => item.defaultOpen).map(item => item.id))
  );

  const toggle = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {items.map(item => {
        const isOpen = openItems.has(item.id);
        const buttonId = `accordion-button-${item.id}`;
        const panelId = `accordion-panel-${item.id}`;

        return (
          <div key={item.id} className="border rounded-lg">
            <h3>
              <button
                id={buttonId}
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset"
              >
                <span className="font-medium">{item.title}</span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </h3>

            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="p-4 border-t"
              >
                {item.children}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Accessible Tabs
// ============================================================================

export interface TabProps {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function AccessibleTabs({ tabs }: { tabs: TabProps[] }) {
  const [activeTab, setActiveTab] = React.useState(tabs[0]?.id);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== index) {
      const nextTab = tabs[nextIndex];
      if (nextTab) {
        setActiveTab(nextTab.id);
        document.getElementById(`tab-${nextTab.id}`)?.focus();
      }
    }
  };

  return (
    <div>
      {/* Tab List */}
      <div role="tablist" className="flex border-b">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`
                px-4 py-2 font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset
                ${isActive
                  ? 'border-b-2 border-violet-600 text-violet-600'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {tabs.map(tab => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="p-4"
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Accessible Checkbox
// ============================================================================

export interface AccessibleCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}

export function AccessibleCheckbox({
  id,
  label,
  checked,
  onChange,
  disabled,
  description,
}: AccessibleCheckboxProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center h-5">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-describedby={descriptionId}
          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50"
        />
      </div>
      <div className="flex-1">
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-900 cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-sm text-gray-600 mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Screen Reader Only Text
// ============================================================================

export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

// ============================================================================
// Live Region for Announcements
// ============================================================================

export function LiveRegion({ 
  message, 
  politeness = 'polite' 
}: { 
  message: string; 
  politeness?: 'polite' | 'assertive';
}) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
