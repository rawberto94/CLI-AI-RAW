'use client';

/**
 * VersionDiffView
 *
 * Side-by-side or inline diff view comparing two versions of a draft.
 * Uses a simple word-level diff algorithm (no external dependency).
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeftRight, Columns, AlignJustify, ChevronDown, RotateCcw, Loader2 } from 'lucide-react';

interface DiffVersion {
  version: number;
  content: string;
  author: string;
  timestamp: string;
  label?: string;
}

interface VersionDiffViewProps {
  versions: DiffVersion[];
  onClose: () => void;
  /**
   * Optional: when provided, renders a "Restore this version" button
   * for the currently-selected non-current version. Caller is
   * responsible for confirming, replacing editor content, and saving.
   */
  onRestore?: (version: DiffVersion) => Promise<void> | void;
}

type DiffMode = 'side-by-side' | 'inline';

interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  text: string;
}

const STRIP_HTML = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** LCS word-level diff for small arrays (safe up to ~100K cells) */
function lcsDiff(oldWords: string[], newWords: string[]): DiffSegment[] {
  const m = oldWords.length;
  const n = newWords.length;

  // Use Uint32Array to avoid overflow (Uint16Array caps at 65535)
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldWords[i - 1] === newWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Trace back
  const stack: DiffSegment[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      stack.push({ type: 'same', text: oldWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'added', text: newWords[j - 1] });
      j--;
    } else {
      stack.push({ type: 'removed', text: oldWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive same-type segments
  stack.reverse();
  const segments: DiffSegment[] = [];
  for (const seg of stack) {
    if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
      segments[segments.length - 1].text += ' ' + seg.text;
    } else {
      segments.push({ ...seg });
    }
  }
  return segments;
}

/**
 * Chunked diff: split into lines first, identify changed line-ranges via LCS,
 * then run word-level diff only within those ranges. This keeps memory bounded
 * even for very large documents.
 */
function chunkedDiff(oldWords: string[], newWords: string[]): DiffSegment[] {
  // Split into ~50-word chunks to create "lines"
  const CHUNK = 50;
  const toChunks = (words: string[]) => {
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += CHUNK) {
      chunks.push(words.slice(i, i + CHUNK).join(' '));
    }
    return chunks;
  };
  const oldChunks = toChunks(oldWords);
  const newChunks = toChunks(newWords);

  // Line-level LCS
  const lineSegments = lcsDiff(oldChunks, newChunks);

  // For "same" segments just pass through; for changed segments do word-level diff
  const result: DiffSegment[] = [];
  let pendingRemoved = '';
  let pendingAdded = '';

  const flushPending = () => {
    if (!pendingRemoved && !pendingAdded) return;
    const rWords = pendingRemoved ? pendingRemoved.split(' ').filter(Boolean) : [];
    const aWords = pendingAdded ? pendingAdded.split(' ').filter(Boolean) : [];
    if (rWords.length * aWords.length <= 100_000) {
      result.push(...lcsDiff(rWords, aWords));
    } else {
      // Still too large — just show as removed+added blocks
      if (rWords.length > 0) result.push({ type: 'removed', text: rWords.join(' ') });
      if (aWords.length > 0) result.push({ type: 'added', text: aWords.join(' ') });
    }
    pendingRemoved = '';
    pendingAdded = '';
  };

  for (const seg of lineSegments) {
    if (seg.type === 'same') {
      flushPending();
      result.push(seg);
    } else if (seg.type === 'removed') {
      pendingRemoved += (pendingRemoved ? ' ' : '') + seg.text;
    } else {
      pendingAdded += (pendingAdded ? ' ' : '') + seg.text;
    }
  }
  flushPending();

  return result;
}

/** Simple word-level diff — routes to LCS or chunked strategy based on size */
function diffWords(oldText: string, newText: string): DiffSegment[] {
  const oldWords = STRIP_HTML(oldText).split(' ').filter(Boolean);
  const newWords = STRIP_HTML(newText).split(' ').filter(Boolean);

  const m = oldWords.length;
  const n = newWords.length;

  // Direct LCS for small docs (≤100K cells ≈ ~316 × 316 words)
  if (m * n <= 100_000) {
    return lcsDiff(oldWords, newWords);
  }

  // Chunked strategy for larger docs — keeps memory bounded
  return chunkedDiff(oldWords, newWords);
}

function DiffSegmentView({ segment }: { segment: DiffSegment }) {
  if (segment.type === 'same') {
    return <span className="text-gray-800 dark:text-slate-200">{segment.text} </span>;
  }
  if (segment.type === 'added') {
    return (
      <span className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-0.5 rounded">
        {segment.text}{' '}
      </span>
    );
  }
  return (
    <span className="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 line-through px-0.5 rounded">
      {segment.text}{' '}
    </span>
  );
}

export function VersionDiffView({ versions, onClose, onRestore }: VersionDiffViewProps) {
  const [leftIdx, setLeftIdx] = useState(versions.length >= 2 ? versions.length - 2 : 0);
  const [rightIdx, setRightIdx] = useState(versions.length - 1);
  const [mode, setMode] = useState<DiffMode>('inline');
  const [restoring, setRestoring] = useState(false);

  const left = versions[leftIdx];
  const right = versions[rightIdx];

  // "Current" is the last version, synthesized by the canvas. We only
  // allow restoring older snapshots, never "Current" itself.
  const isLeftCurrent = left?.label === 'Current' || left?.author === 'Current';
  const canRestoreLeft = Boolean(onRestore && left && !isLeftCurrent);

  const handleRestore = useCallback(async () => {
    if (!onRestore || !left || isLeftCurrent) return;
    const ok = typeof window !== 'undefined'
      ? window.confirm(
          `Restore v${left.version}?\n\nThis will replace the current draft content with the contents of version ${left.version} (${left.label || 'Save'} by ${left.author}). The current draft will be saved as a new version first so nothing is lost.`,
        )
      : true;
    if (!ok) return;
    try {
      setRestoring(true);
      await onRestore(left);
    } finally {
      setRestoring(false);
    }
  }, [onRestore, left, isLeftCurrent]);

  const diffSegments = useMemo(() => {
    if (!left || !right) return [];
    return diffWords(left.content, right.content);
  }, [left, right]);

  const stats = useMemo(() => {
    let added = 0, removed = 0;
    for (const seg of diffSegments) {
      const words = seg.text.split(/\s+/).filter(Boolean).length;
      if (seg.type === 'added') added += words;
      if (seg.type === 'removed') removed += words;
    }
    return { added, removed };
  }, [diffSegments]);

  if (versions.length < 2) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-slate-400">
        <p className="text-sm">Need at least 2 versions to compare.</p>
        <button onClick={onClose} className="mt-3 text-violet-600 dark:text-violet-400 text-sm hover:underline">Close</button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Version Comparison</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600 dark:text-green-400 font-medium">+{stats.added} words</span>
            <span className="text-red-600 dark:text-red-400 font-medium">-{stats.removed} words</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-600 rounded-lg p-0.5">
            <button
              onClick={() => setMode('inline')}
              className={`p-1.5 rounded-md text-xs transition-colors ${mode === 'inline' ? 'bg-white dark:bg-slate-500 shadow-sm text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}
              title="Inline diff"
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setMode('side-by-side')}
              className={`p-1.5 rounded-md text-xs transition-colors ${mode === 'side-by-side' ? 'bg-white dark:bg-slate-500 shadow-sm text-gray-900 dark:text-slate-100' : 'text-gray-500 dark:text-slate-400'}`}
              title="Side by side"
            >
              <Columns className="h-3.5 w-3.5" />
            </button>
          </div>
          {canRestoreLeft && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={restoring}
              className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              title={`Restore v${left?.version} as the current draft content`}
              aria-label={`Restore version ${left?.version}`}
            >
              {restoring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              <span>{restoring ? 'Restoring…' : `Restore v${left?.version}`}</span>
            </button>
          )}
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200" aria-label="Close diff view">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Version selectors */}
      <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-slate-400 text-xs">Old:</span>
          <select
            value={leftIdx}
            onChange={(e) => setLeftIdx(parseInt(e.target.value))}
            className="text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
          >
            {versions.map((v, i) => (
              <option key={i} value={i}>v{v.version} — {v.author} ({v.label || 'Save'})</option>
            ))}
          </select>
        </div>
        <ArrowLeftRight className="h-3 w-3 text-gray-400" />
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-slate-400 text-xs">New:</span>
          <select
            value={rightIdx}
            onChange={(e) => setRightIdx(parseInt(e.target.value))}
            className="text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
          >
            {versions.map((v, i) => (
              <option key={i} value={i}>v{v.version} — {v.author} ({v.label || 'Save'})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Diff content */}
      <div className="p-4 max-h-[50vh] overflow-y-auto">
        {mode === 'inline' ? (
          <div className="prose prose-sm dark:prose-invert max-w-none font-serif leading-relaxed">
            {diffSegments.map((seg, i) => (
              <DiffSegmentView key={i} segment={seg} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-800/30">
              <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                v{left.version} — {left.author}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none font-serif text-sm leading-relaxed">
                {diffSegments
                  .filter((s) => s.type === 'same' || s.type === 'removed')
                  .map((seg, i) => (
                    <DiffSegmentView key={i} segment={seg} />
                  ))}
              </div>
            </div>
            <div className="p-3 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800/30">
              <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                v{right.version} — {right.author}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none font-serif text-sm leading-relaxed">
                {diffSegments
                  .filter((s) => s.type === 'same' || s.type === 'added')
                  .map((seg, i) => (
                    <DiffSegmentView key={i} segment={seg} />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default VersionDiffView;
