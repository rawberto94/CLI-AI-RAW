/**
 * MarkdownContent — Proper markdown renderer for AI chat messages.
 *
 * Replaces regex-based .replace() chains + dangerouslySetInnerHTML with
 * react-markdown for safe, correct rendering of:
 *  - GFM tables, strikethrough, task lists
 *  - Fenced code blocks with syntax highlighting
 *  - Internal contract links [Title](/contracts/ID)
 *  - Bold, italic, headings, lists, blockquotes
 *
 * @version 1.0.0
 */

'use client';

import Link from 'next/link';
import React, { memo, useCallback, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

// ─── Copy-to-clipboard helper ───────────────────────────────────────────

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = getText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [getText]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors text-xs"
      title="Copy to clipboard"
      type="button"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// ─── Custom link handler (internal navigation for contract links) ───────

const MarkdownLink: Components['a'] = ({ href, children, ...props }) => {
  const isInternal = href?.startsWith('/');
  if (isInternal && href) {
    return (
      <Link
        href={href}
        className="text-violet-600 hover:text-violet-800 underline font-medium"
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className="text-violet-600 hover:text-violet-800 underline font-medium"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
};

// ─── Code block with copy button ────────────────────────────────────────

const MarkdownCode: Components['code'] = ({ className, children, ...props }) => {
  const isBlock = className?.startsWith('language-') || className?.startsWith('hljs');

  if (!isBlock) {
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-black/10 text-inherit text-[13px] font-mono"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <code className={`${className || ''} text-[13px]`} {...props}>
      {children}
    </code>
  );
};

const MarkdownPre: Components['pre'] = ({ children, ...props }) => {
  const getText = useCallback(() => {
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (React.isValidElement(node) && node.props) {
        return extractText((node.props as { children?: React.ReactNode }).children ?? '');
      }
      return '';
    };
    return extractText(children);
  }, [children]);

  return (
    <pre
      className="relative rounded-lg bg-gray-900 text-gray-100 p-4 overflow-x-auto my-3 text-[13px]"
      {...props}
    >
      <CopyButton getText={getText} />
      {children}
    </pre>
  );
};

// ─── Table styling ──────────────────────────────────────────────────────

function TableCopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = getText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [getText]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-1 right-1 p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-xs"
      title="Copy table"
      type="button"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

const MarkdownTable: Components['table'] = ({ children, ...props }) => {
  const getText = useCallback(() => {
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (React.isValidElement(node) && node.props) {
        return extractText((node.props as { children?: React.ReactNode }).children ?? '');
      }
      return '';
    };
    return extractText(children);
  }, [children]);

  return (
    <div className="relative overflow-x-auto my-3 group/table">
      <TableCopyButton getText={getText} />
      <table className="min-w-full text-sm border-collapse border border-gray-200 rounded" {...props}>
        {children}
      </table>
    </div>
  );
};

const MarkdownTh: Components['th'] = ({ children, ...props }) => (
  <th className="bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-600 border border-gray-200" {...props}>
    {children}
  </th>
);

const MarkdownTd: Components['td'] = ({ children, ...props }) => (
  <td className="px-3 py-2 text-sm text-gray-700 border border-gray-200" {...props}>
    {children}
  </td>
);

// ─── Component map ──────────────────────────────────────────────────────

const markdownComponents: Components = {
  a: MarkdownLink,
  code: MarkdownCode,
  pre: MarkdownPre,
  table: MarkdownTable,
  th: MarkdownTh,
  td: MarkdownTd,
};

// ─── Public component ───────────────────────────────────────────────────

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className = '',
}: MarkdownContentProps) {
  if (!content) return null;

  return (
    <div
      className={`prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-violet-600 prose-p:leading-relaxed prose-li:leading-relaxed ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownContent;
