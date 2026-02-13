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

import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

// ─── Custom link handler (internal navigation for contract links) ───────

const MarkdownLink: Components['a'] = ({ href, children, ...props }) => {
  const isInternal = href?.startsWith('/');
  return (
    <a
      href={href}
      className="text-violet-600 hover:text-violet-800 underline font-medium"
      target={isInternal ? undefined : '_blank'}
      rel={isInternal ? undefined : 'noopener noreferrer'}
      onClick={
        isInternal
          ? (e) => {
              e.preventDefault();
              window.location.href = href!;
            }
          : undefined
      }
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
        className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[13px] font-mono"
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
  return (
    <pre
      className="rounded-lg bg-gray-900 text-gray-100 p-4 overflow-x-auto my-3 text-[13px]"
      {...props}
    >
      {children}
    </pre>
  );
};

// ─── Table styling ──────────────────────────────────────────────────────

const MarkdownTable: Components['table'] = ({ children, ...props }) => (
  <div className="overflow-x-auto my-3">
    <table className="min-w-full text-sm border-collapse border border-gray-200 rounded" {...props}>
      {children}
    </table>
  </div>
);

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
