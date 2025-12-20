'use client';

/**
 * Copy to Clipboard
 * Copy text with visual feedback and animation
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Link, Code, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type CopyVariant = 'default' | 'code' | 'link' | 'minimal';

interface CopyButtonProps {
  text: string;
  variant?: CopyVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onCopy?: () => void;
  label?: string;
  showLabel?: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, []);

  return { copied, copy };
}

// ============================================================================
// Copy Button Component
// ============================================================================

export function CopyButton({
  text,
  variant = 'default',
  size = 'md',
  className,
  onCopy,
  label = 'Copy',
  showLabel = false,
}: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = async () => {
    const success = await copy(text);
    if (success) onCopy?.();
  };

  const sizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const variants = {
    default: 'bg-slate-100 hover:bg-slate-200 text-slate-600',
    code: 'bg-slate-700 hover:bg-slate-600 text-slate-300',
    link: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-600',
    minimal: 'hover:bg-slate-100 text-slate-400 hover:text-slate-600',
  };

  const icons = {
    default: Copy,
    code: Code,
    link: Link,
    minimal: Copy,
  };

  const Icon = icons[variant];

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg transition-all duration-200',
        sizes[size],
        variants[variant],
        showLabel && 'w-auto px-3 gap-2',
        className
      )}
      title={copied ? 'Copied!' : label}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="text-emerald-500"
          >
            <Check className={iconSizes[size]} />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Icon className={iconSizes[size]} />
          </motion.div>
        )}
      </AnimatePresence>
      {showLabel && (
        <span className="text-sm font-medium">
          {copied ? 'Copied!' : label}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Copyable Text Component
// ============================================================================

interface CopyableTextProps {
  text: string;
  displayText?: string;
  variant?: 'inline' | 'block' | 'code';
  truncate?: boolean;
  className?: string;
}

export function CopyableText({
  text,
  displayText,
  variant = 'inline',
  truncate = false,
  className,
}: CopyableTextProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div
      className={cn(
        'group relative inline-flex items-center gap-2',
        variant === 'block' && 'w-full',
        className
      )}
    >
      <span
        className={cn(
          variant === 'code' && 'font-mono text-sm bg-slate-100 px-2 py-1 rounded',
          truncate && 'truncate',
          variant === 'block' && 'flex-1'
        )}
      >
        {displayText || text}
      </span>
      <button
        onClick={() => copy(text)}
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded',
          copied && 'opacity-100 text-emerald-500'
        )}
      >
        {copied ? (
          <Check className="w-4 h-4" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
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
  className?: string;
}

export function CodeBlock({
  code,
  language = 'text',
  showLineNumbers = false,
  className,
}: CodeBlockProps) {
  const lines = code.split('\n');

  return (
    <div className={cn('relative group rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-medium text-slate-400 uppercase">
          {language}
        </span>
        <CopyButton text={code} variant="code" size="sm" />
      </div>

      {/* Code */}
      <div className="bg-slate-900 p-4 overflow-x-auto">
        <pre className="text-sm">
          <code className="text-slate-300 font-mono">
            {showLineNumbers ? (
              <table className="border-collapse">
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="pr-4 text-slate-500 text-right select-none w-8">
                        {i + 1}
                      </td>
                      <td className="whitespace-pre">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              code
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// Share Link Component
// ============================================================================

interface ShareLinkProps {
  url: string;
  label?: string;
  className?: string;
}

export function ShareLink({ url, label = 'Share link', className }: ShareLinkProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
        <Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={url}
          readOnly
          className="flex-1 bg-transparent text-sm text-slate-700 outline-none min-w-0"
          aria-label="URL to copy"
        />
      </div>
      <button
        onClick={() => copy(url)}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-all',
          copied
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        )}
      >
        {copied ? (
          <span className="flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            Copied!
          </span>
        ) : (
          label
        )}
      </button>
    </div>
  );
}
