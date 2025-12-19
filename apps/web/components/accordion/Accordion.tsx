'use client';

/**
 * Accordion Component
 * Collapsible content sections with animations
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type AccordionType = 'single' | 'multiple';

interface AccordionContextValue {
  type: AccordionType;
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
  variant: 'default' | 'bordered' | 'separated';
}

// ============================================================================
// Context
// ============================================================================

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion provider');
  }
  return context;
}

// ============================================================================
// Accordion Root
// ============================================================================

interface AccordionProps {
  type?: AccordionType;
  defaultExpanded?: string[];
  variant?: 'default' | 'bordered' | 'separated';
  children: React.ReactNode;
  className?: string;
}

export function Accordion({
  type = 'single',
  defaultExpanded = [],
  variant = 'default',
  children,
  className,
}: AccordionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(defaultExpanded)
  );

  const toggleItem = useCallback(
    (id: string) => {
      setExpandedItems((prev) => {
        const next = new Set(prev);

        if (next.has(id)) {
          next.delete(id);
        } else {
          if (type === 'single') {
            next.clear();
          }
          next.add(id);
        }

        return next;
      });
    },
    [type]
  );

  const variantStyles = {
    default: 'divide-y divide-slate-200',
    bordered: 'border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden',
    separated: 'space-y-3',
  };

  return (
    <AccordionContext.Provider value={{ type, expandedItems, toggleItem, variant }}>
      <div className={cn(variantStyles[variant], className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

// ============================================================================
// Accordion Item
// ============================================================================

interface AccordionItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ id, children, className }: AccordionItemProps) {
  const { variant } = useAccordionContext();

  const variantStyles = {
    default: '',
    bordered: '',
    separated: 'border border-slate-200 rounded-xl overflow-hidden',
  };

  return (
    <div className={cn(variantStyles[variant], className)} data-accordion-item={id}>
      {children}
    </div>
  );
}

// ============================================================================
// Accordion Trigger
// ============================================================================

interface AccordionTriggerProps {
  id: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  iconStyle?: 'chevron' | 'plus-minus';
  className?: string;
}

export function AccordionTrigger({
  id,
  children,
  icon,
  iconStyle = 'chevron',
  className,
}: AccordionTriggerProps) {
  const { expandedItems, toggleItem } = useAccordionContext();
  const isExpanded = expandedItems.has(id);
  const Icon = icon;

  return (
    <button
      onClick={() => toggleItem(id)}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-4 text-left',
        'transition-colors hover:bg-slate-50',
        className
      )}
      aria-expanded={isExpanded}
    >
      {Icon && <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      <span className="flex-1 font-medium text-slate-900">{children}</span>
      
      {iconStyle === 'chevron' ? (
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </motion.div>
      ) : (
        <div className="text-slate-400">
          {isExpanded ? (
            <Minus className="w-5 h-5" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Accordion Content
// ============================================================================

interface AccordionContentProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionContent({ id, children, className }: AccordionContentProps) {
  const { expandedItems } = useAccordionContext();
  const isExpanded = expandedItems.has(id);

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className={cn('px-4 pb-4 text-sm text-slate-600', className)}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Simple Accordion (all-in-one)
// ============================================================================

interface SimpleAccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  icon?: LucideIcon;
}

interface SimpleAccordionProps {
  items: SimpleAccordionItem[];
  type?: AccordionType;
  variant?: 'default' | 'bordered' | 'separated';
  defaultExpanded?: string[];
  className?: string;
}

export function SimpleAccordion({
  items,
  type = 'single',
  variant = 'bordered',
  defaultExpanded = [],
  className,
}: SimpleAccordionProps) {
  return (
    <Accordion type={type} variant={variant} defaultExpanded={defaultExpanded} className={className}>
      {items.map((item) => (
        <AccordionItem key={item.id} id={item.id}>
          <AccordionTrigger id={item.id} icon={item.icon}>
            {item.title}
          </AccordionTrigger>
          <AccordionContent id={item.id}>{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// ============================================================================
// FAQ Accordion (styled for FAQs)
// ============================================================================

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  className?: string;
}

export function FAQAccordion({ items, className }: FAQAccordionProps) {
  return (
    <Accordion type="single" variant="separated" className={className}>
      {items.map((item, index) => {
        const id = `faq-${index}`;
        return (
          <AccordionItem key={id} id={id}>
            <AccordionTrigger id={id} iconStyle="plus-minus" className="py-5">
              <span className="text-base">{item.question}</span>
            </AccordionTrigger>
            <AccordionContent id={id} className="text-base leading-relaxed">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
