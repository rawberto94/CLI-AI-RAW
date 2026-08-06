'use client';

/**
 * Shared citation / evidence list used by chat (FloatingAIBubble) and
 * agent approval surfaces. Clickable chips deep-link to the contract span.
 */

import React, { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, FileText } from 'lucide-react';
import {
  buildCitationHref,
  normalizeCitations,
  type Citation,
} from '@/lib/ai/citations';

export interface CitationListProps {
  /** Raw citations JSON or already-normalized Citation[] */
  citations?: unknown;
  /** Fallback contract when citations omit contractId */
  contractId?: string | null;
  emptyLabel?: string;
  /** Max items to show (default 10; chat historically used 3) */
  maxItems?: number;
  /** Called when user expands or interacts with a citation (telemetry) */
  onEvidenceViewed?: () => void;
  /** Called when a citation is opened */
  onCitationOpen?: (citation: Citation) => void;
  /**
   * When true (default), deep-link to the contract via router.
   * Set false when the parent handles preview (e.g. FloatingAIBubble modal).
   */
  navigateOnOpen?: boolean;
  className?: string;
  /** Compact mode skips motion and uses denser spacing */
  compact?: boolean;
}

export function CitationList({
  citations,
  contractId,
  emptyLabel = 'No evidence recorded',
  maxItems = 10,
  onEvidenceViewed,
  onCitationOpen,
  navigateOnOpen = true,
  className = '',
  compact = false,
}: CitationListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const items = normalizeCitations(citations, contractId).slice(0, maxItems);

  const openCitation = useCallback(
    (citation: Citation) => {
      onCitationOpen?.(citation);
      onEvidenceViewed?.();
      if (!navigateOnOpen) return;
      const href = buildCitationHref(citation, {
        pathname,
        searchParams: searchParams?.toString() ?? '',
      });
      if (href) {
        router.push(href);
      }
    },
    [onCitationOpen, onEvidenceViewed, navigateOnOpen, pathname, router, searchParams],
  );

  if (items.length === 0) {
    return (
      <p className={`text-xs text-slate-400 italic ${className}`} data-testid="citation-list-empty">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className={className} data-testid="citation-list">
      <details
        className="text-xs group/sources"
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) {
            onEvidenceViewed?.();
          }
        }}
      >
        <summary className="cursor-pointer text-violet-600 hover:text-violet-700 flex items-center gap-1.5 font-medium transition-colors list-none">
          <FileText className="w-3.5 h-3.5" />
          <span>
            {items.length} source{items.length !== 1 ? 's' : ''} referenced
          </span>
          <span className="text-gray-400 ml-auto">›</span>
        </summary>
        <ul className={`mt-2.5 space-y-2 text-gray-600 ${compact ? 'space-y-1.5' : ''}`}>
          {items.map((src) => {
            const canLink = Boolean(src.contractId);
            const scorePct = Math.round((src.score > 1 ? src.score : src.score * 100));
            return (
              <li
                key={`${src.index}-${src.contractId ?? src.contractName}-${src.startOffset ?? 0}`}
                className="bg-gray-50 rounded-lg border border-gray-200 hover:border-violet-300 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => openCitation(src)}
                  disabled={!canLink}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left disabled:cursor-default disabled:opacity-80"
                  aria-label={`Citation ${src.index}: ${src.contractName}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded flex-shrink-0"
                        aria-label={`Citation ${src.index}`}
                      >
                        [{src.index}]
                      </span>
                      <FileText className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                      <span className="truncate font-medium">{src.contractName}</span>
                      {(src.heading || src.section) && (
                        <span className="hidden sm:inline rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-gray-200">
                          {src.heading || src.section}
                        </span>
                      )}
                    </div>
                    {src.snippet && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">
                        {src.snippet}
                      </p>
                    )}
                    {(typeof src.startOffset === 'number' || typeof src.endOffset === 'number') && (
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        Span {typeof src.startOffset === 'number' ? src.startOffset : '?'}
                        {typeof src.endOffset === 'number' ? `-${src.endOffset}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {scorePct > 0 && (
                      <span className="text-xs font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {scorePct}%
                      </span>
                    )}
                    {canLink && <ExternalLink className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

export default CitationList;
