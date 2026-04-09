'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, AlertTriangle, CheckCircle, Info, X, 
  ChevronDown, ChevronUp, ExternalLink, Copy, Check
} from 'lucide-react';

// ============================================================================
// Alert Banner
// ============================================================================

interface AlertBannerProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function AlertBanner({
  type,
  title,
  message,
  dismissible = true,
  onDismiss,
  action,
  className = '',
}: AlertBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  const typeStyles = {
    info: {
      bg: 'bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800',
      icon: <Info className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
      text: 'text-violet-800 dark:text-violet-200',
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
      icon: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
      text: 'text-green-800 dark:text-green-200',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
      icon: <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
      text: 'text-yellow-800 dark:text-yellow-200',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
      icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
      text: 'text-red-800 dark:text-red-200',
    },
  };

  const styles = typeStyles[type];

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div key="visible"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`flex items-start gap-3 p-4 rounded-xl border ${styles.bg} ${className}`}
        >
          <div className="shrink-0 mt-0.5">{styles.icon}</div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${styles.text}`}>{title}</p>
            {message && (
              <p className={`mt-1 text-sm opacity-90 ${styles.text}`}>{message}</p>
            )}
            {action && (
              <button
                onClick={action.onClick}
                className={`mt-2 text-sm font-medium underline underline-offset-2 ${styles.text}`}
              >
                {action.label}
              </button>
            )}
          </div>
          {dismissible && (
            <button
              onClick={handleDismiss}
              className={`shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 ${styles.text}`}
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
// Inline Alert
// ============================================================================

interface InlineAlertProps {
  type: 'info' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

export function InlineAlert({ type, children, className = '' }: InlineAlertProps) {
  const typeStyles = {
    info: 'text-violet-600 dark:text-violet-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  };

  const icons = {
    info: <Info className="w-4 h-4" />,
    success: <CheckCircle className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
  };

  return (
    <div className={`flex items-start gap-2 text-sm ${typeStyles[type]} ${className}`}>
      <div className="shrink-0 mt-0.5">{icons[type]}</div>
      <div>{children}</div>
    </div>
  );
}

// ============================================================================
// Callout
// ============================================================================

interface CalloutProps {
  type?: 'note' | 'tip' | 'important' | 'warning' | 'caution';
  title?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function Callout({
  type = 'note',
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  className = '',
}: CalloutProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const typeStyles = {
    note: {
      bg: 'bg-violet-50 dark:bg-violet-950',
      border: 'border-l-4 border-violet-500',
      icon: <Info className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
      title: title || 'Note',
    },
    tip: {
      bg: 'bg-green-50 dark:bg-green-950',
      border: 'border-l-4 border-green-500',
      icon: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
      title: title || 'Tip',
    },
    important: {
      bg: 'bg-violet-50 dark:bg-violet-950',
      border: 'border-l-4 border-violet-500',
      icon: <AlertCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />,
      title: title || 'Important',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-950',
      border: 'border-l-4 border-yellow-500',
      icon: <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
      title: title || 'Warning',
    },
    caution: {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-l-4 border-red-500',
      icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
      title: title || 'Caution',
    },
  };

  const styles = typeStyles[type];

  return (
    <div className={`${styles.bg} ${styles.border} rounded-r-lg overflow-hidden ${className}`}>
      <button
        onClick={() => collapsible && setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-4 py-3 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {styles.icon}
        <span className="font-semibold text-gray-900 dark:text-white flex-1 text-left">
          {styles.title}
        </span>
        {collapsible && (
          isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 text-gray-700 dark:text-gray-300">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Code Block with Copy
// ============================================================================

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
}

export function CodeBlock({
  code,
  language = 'text',
  showLineNumbers = false,
  highlightLines = [],
  className = '',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm text-gray-400">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>
      
      <div className="overflow-x-auto p-4">
        <pre className="text-sm font-mono">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`${
                highlightLines.includes(i + 1)
                  ? 'bg-yellow-500/20 -mx-4 px-4'
                  : ''
              }`}
            >
              {showLineNumbers && (
                <span className="inline-block w-8 text-gray-500 select-none">
                  {i + 1}
                </span>
              )}
              <span className="text-gray-100">{line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// Message Bubble
// ============================================================================

interface MessageBubbleProps {
  content: string;
  sender: 'user' | 'other';
  timestamp?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  avatar?: string;
  name?: string;
  className?: string;
}

export function MessageBubble({
  content,
  sender,
  timestamp,
  status,
  avatar,
  name,
  className = '',
}: MessageBubbleProps) {
  const isUser = sender === 'user';

  const statusIcons = {
    sending: <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />,
    sent: <Check className="w-3 h-3 text-gray-400" />,
    delivered: <div className="flex -space-x-1"><Check className="w-3 h-3 text-gray-400" /><Check className="w-3 h-3 text-gray-400" /></div>,
    read: <div className="flex -space-x-1"><Check className="w-3 h-3 text-violet-500" /><Check className="w-3 h-3 text-violet-500" /></div>,
  };

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''} ${className}`}>
      {avatar && (
        
        <Image src={avatar} alt={`${name}'s avatar`} width={32} height={32} className="w-8 h-8 rounded-full shrink-0" />
      )}
      <div className={`max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        {name && !isUser && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-1">{name}</p>
        )}
        <div
          className={`px-4 py-2 rounded-2xl ${
            isUser
              ? 'bg-violet-600 text-white rounded-br-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
        <div className={`flex items-center gap-1 mt-1 px-1 ${isUser ? 'justify-end' : ''}`}>
          {timestamp && (
            <span className="text-xs text-gray-400">{timestamp}</span>
          )}
          {isUser && status && statusIcons[status]}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// System Message
// ============================================================================

interface SystemMessageProps {
  message: string;
  type?: 'info' | 'date' | 'action';
  icon?: React.ReactNode;
  className?: string;
}

export function SystemMessage({
  message,
  type = 'info',
  icon,
  className = '',
}: SystemMessageProps) {
  return (
    <div className={`flex justify-center py-2 ${className}`}>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
        type === 'date'
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          : type === 'action'
          ? 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400'
          : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-500'
      }`}>
        {icon}
        <span>{message}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Announcement Bar
// ============================================================================

interface AnnouncementBarProps {
  message: string;
  type?: 'info' | 'promo' | 'warning';
  link?: {
    text: string;
    href: string;
  };
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function AnnouncementBar({
  message,
  type = 'info',
  link,
  dismissible = true,
  onDismiss,
  className = '',
}: AnnouncementBarProps) {
  const [isVisible, setIsVisible] = useState(true);

  const typeStyles = {
    info: 'bg-violet-600 text-white',
    promo: 'bg-gradient-to-r from-violet-600 to-pink-600 text-white',
    warning: 'bg-yellow-400 text-yellow-900',
  };

  if (!isVisible) return null;

  return (
    <div className={`relative ${typeStyles[type]} ${className}`}>
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-center gap-4">
        <p className="text-sm font-medium">
          {message}
          {link && (
            <a
              href={link.href}
              className="ml-2 underline underline-offset-2 hover:no-underline inline-flex items-center gap-1"
            >
              {link.text}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
        {dismissible && (
          <button
            onClick={() => {
              setIsVisible(false);
              onDismiss?.();
            }}
            className="absolute right-4 p-1 hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
