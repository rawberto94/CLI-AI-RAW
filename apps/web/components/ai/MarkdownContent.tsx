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
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const DEFAULT_INTERNAL_LINK_CLASSNAME = 'text-violet-600 hover:text-violet-800 underline font-medium';
const CITATION_LINK_CLASSNAME = 'mx-0.5 inline-flex min-w-5 -translate-y-[0.3em] items-center justify-center rounded-full border border-violet-200 bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-violet-700 no-underline transition-colors hover:border-violet-300 hover:bg-violet-200 hover:text-violet-800';

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
      className="absolute top-1 right-8 p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-xs"
      title="Copy table"
      type="button"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

function TableCsvButton({ tableRef }: { tableRef: React.RefObject<HTMLTableElement | null> }) {
  const handleDownload = useCallback(() => {
    const table = tableRef.current;
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows
      .map((row) =>
        Array.from(row.querySelectorAll('th,td'))
          .map((cell) => {
            const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
            const escaped = text.replace(/"/g, '""');
            return /[,"\n]/.test(text) ? `"${escaped}"` : escaped;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tableRef]);

  return (
    <button
      onClick={handleDownload}
      className="absolute top-1 right-1 p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors text-xs"
      title="Download as CSV"
      type="button"
    >
      ⬇
    </button>
  );
}

const MarkdownTable: Components['table'] = ({ children, ...props }) => {
  const tableRef = React.useRef<HTMLTableElement | null>(null);
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
      <TableCsvButton tableRef={tableRef} />
      <table ref={tableRef} className="min-w-full text-sm border-collapse border border-gray-200 rounded" {...props}>
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

const baseMarkdownComponents: Components = {
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
  onInternalLinkClick?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => boolean | void;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className = '',
  onInternalLinkClick,
}: MarkdownContentProps) {
  if (!content) return null;

  const markdownComponents = React.useMemo<Components>(() => ({
    ...baseMarkdownComponents,
    a: ({ href, children, ...props }) => {
      const isInternal = href?.startsWith('/');
      const isCitationLink = Boolean(href?.includes('cite=1'));

      if (isInternal && href) {
        return (
          <Link
            href={href}
            className={isCitationLink ? CITATION_LINK_CLASSNAME : DEFAULT_INTERNAL_LINK_CLASSNAME}
            title={isCitationLink ? 'Inspect source evidence' : undefined}
            onClick={(event) => {
              const handled = onInternalLinkClick?.(href, event);
              if (handled) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            {children}
          </Link>
        );
      }

      return (
        <a
          href={href}
          className={DEFAULT_INTERNAL_LINK_CLASSNAME}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
  }), [onInternalLinkClick]);

  return (
    <div
      className={`prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-violet-600 prose-p:leading-relaxed prose-li:leading-relaxed ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownContent;
