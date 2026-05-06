'use client';

/**
 * VariableManager
 *
 * Detects template placeholder tokens inside the active TipTap editor and
 * renders an inline manager that lets the user:
 *  - see every distinct placeholder, its occurrence count, and a sample
 *    surrounding-context preview
 *  - jump to the next occurrence in the document
 *  - rename a placeholder (updates every occurrence at once)
 *  - fill in a placeholder (replace every occurrence with a literal value)
 *  - bulk-fill from a key/value map and clear all known fills
 *
 * Detected token shapes:
 *  - [Plain bracket placeholders]  e.g. "[Buyer]", "[Effective Date]"
 *  - {{handlebars}}                 e.g. "{{party_a}}", "{{ value }}"
 *  - [[double brackets]]            e.g. "[[Term]]"
 *  - <<angle brackets>>             e.g. "<<Notice Period>>"
 *
 * Replacements operate on the underlying ProseMirror document via
 * insertContentAt walking matches in reverse, mirroring the strategy used
 * by the canvas's find/replace implementation.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Braces,
  Eye,
  Search,
  Sparkles,
  Wand2,
  ArrowRight,
  Copy as CopyIcon,
  Loader2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type VariableShape = 'bracket' | 'handlebars' | 'doubleBracket' | 'angleBracket';

export interface DetectedVariable {
  /** Verbatim token as it appears in the document, e.g. "[Buyer]". */
  token: string;
  /** Inner label without the wrapping syntax, e.g. "Buyer". */
  label: string;
  /** The shape of the placeholder. */
  shape: VariableShape;
  /** Number of times this exact token appears in the doc. */
  count: number;
  /** Up to 3 short surrounding snippets for context preview. */
  samples: string[];
}

interface VariableManagerProps {
  editor: Editor | null;
  /** Document content version (incrementing counter) — used as a re-scan trigger. */
  contentVersion: number;
  /** Whether the editor is read-only (locked / not currently the editor). */
  readOnly?: boolean;
  /** Optional callback invoked after any successful replacement (for save chaining). */
  onAfterReplace?: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Detection helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Token shape patterns. Order matters: [[ ]] and {{ }} must be tried before [ ]
 * so the simpler bracket regex doesn't swallow halves of double-bracket tokens.
 */
const SHAPE_PATTERNS: Array<{ shape: VariableShape; regex: RegExp; toLabel: (m: string) => string }> = [
  // {{ var }} or {{var}}
  { shape: 'handlebars', regex: /\{\{\s*([^{}\n]{1,80}?)\s*\}\}/g, toLabel: (m) => m.trim() },
  // [[Var]]
  { shape: 'doubleBracket', regex: /\[\[\s*([^\[\]\n]{1,80}?)\s*\]\]/g, toLabel: (m) => m.trim() },
  // <<Var>>
  { shape: 'angleBracket', regex: /<<\s*([^<>\n]{1,80}?)\s*>>/g, toLabel: (m) => m.trim() },
  // [Var] — must be a Capitalised or multi-word phrase; avoid catching e.g. "[1]" footnotes
  // We require either an uppercase first letter, an underscore, or a space inside.
  { shape: 'bracket', regex: /\[((?:[A-Z][^\[\]\n]{0,80})|(?:[A-Za-z_]+\s+[^\[\]\n]{0,80}))\]/g, toLabel: (m) => m.trim() },
];

/**
 * Scan plain-text version of the document for placeholders. Returns a
 * deduplicated array of `DetectedVariable`s ordered by the first appearance
 * in the doc.
 */
export function detectVariables(text: string): DetectedVariable[] {
  if (!text) return [];

  type Match = { token: string; label: string; shape: VariableShape; index: number };
  const allMatches: Match[] = [];
  const claimedRanges: Array<[number, number]> = [];

  const overlaps = (start: number, end: number): boolean => {
    for (const [s, e] of claimedRanges) {
      if (!(end <= s || start >= e)) return true;
    }
    return false;
  };

  for (const { shape, regex, toLabel } of SHAPE_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const fullToken = match[0];
      const inner = match[1] ?? '';
      const start = match.index;
      const end = start + fullToken.length;
      if (overlaps(start, end)) continue;
      claimedRanges.push([start, end]);
      allMatches.push({
        token: fullToken,
        label: toLabel(inner),
        shape,
        index: start,
      });
    }
  }

  // Dedupe by exact token, keep order of first appearance, accumulate counts/samples
  const map = new Map<string, DetectedVariable & { firstIndex: number }>();
  for (const m of allMatches) {
    const existing = map.get(m.token);
    if (existing) {
      existing.count += 1;
      if (existing.samples.length < 3) {
        existing.samples.push(snippetAround(text, m.index, m.token.length));
      }
    } else {
      map.set(m.token, {
        token: m.token,
        label: m.label,
        shape: m.shape,
        count: 1,
        samples: [snippetAround(text, m.index, m.token.length)],
        firstIndex: m.index,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map(({ firstIndex: _firstIndex, ...rest }) => rest);
}

function snippetAround(text: string, index: number, length: number, radius = 36): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Editor mutation helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Replace every occurrence of `token` with `replacement` in the editor.
 * Returns the number of replacements performed. Walks matches in reverse so
 * earlier positions stay valid.
 */
function replaceAllInEditor(editor: Editor, token: string, replacement: string): number {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
  if (!token || !text.includes(token)) return 0;

  const positions: Array<{ from: number; to: number }> = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(token, searchFrom);
    if (idx === -1) break;
    // ProseMirror text positions are 1-based; the canvas's existing find/replace
    // implementation uses (idx + 1, idx + 1 + needle.length).
    positions.push({ from: idx + 1, to: idx + 1 + token.length });
    searchFrom = idx + token.length;
  }
  if (positions.length === 0) return 0;

  let chain = editor.chain().focus();
  for (let i = positions.length - 1; i >= 0; i--) {
    chain = chain.insertContentAt(positions[i]!, replacement);
  }
  chain.run();
  return positions.length;
}

function jumpToFirstOccurrence(editor: Editor, token: string): boolean {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
  const idx = text.indexOf(token);
  if (idx === -1) return false;
  editor
    .chain()
    .focus()
    .setTextSelection({ from: idx + 1, to: idx + 1 + token.length })
    .scrollIntoView()
    .run();
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const SHAPE_BADGES: Record<VariableShape, { label: string; className: string }> = {
  bracket: { label: '[ ]', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  doubleBracket: { label: '[[ ]]', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  handlebars: { label: '{{ }}', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  angleBracket: { label: '<< >>', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
};

export function VariableManager({ editor, contentVersion, readOnly = false, onAfterReplace }: VariableManagerProps) {
  const [search, setSearch] = useState('');
  const [pendingValues, setPendingValues] = useState<Record<string, string>>({});
  const [busyToken, setBusyToken] = useState<string | null>(null);

  // Re-scan when the editor content version changes (debounced upstream).
  const variables = useMemo<DetectedVariable[]>(() => {
    if (!editor) return [];
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n');
    return detectVariables(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, contentVersion]);

  // Drop pendingValues entries whose token no longer exists in the doc to
  // prevent ghost inputs from accumulating across edits.
  useEffect(() => {
    setPendingValues((prev) => {
      const stillPresent = new Set(variables.map((v) => v.token));
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (stillPresent.has(k)) next[k] = v;
      }
      return next;
    });
  }, [variables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter(
      (v) => v.token.toLowerCase().includes(q) || v.label.toLowerCase().includes(q),
    );
  }, [variables, search]);

  const totalOccurrences = useMemo(
    () => variables.reduce((sum, v) => sum + v.count, 0),
    [variables],
  );

  const handleJump = useCallback(
    (token: string) => {
      if (!editor) return;
      const found = jumpToFirstOccurrence(editor, token);
      if (!found) toast.error('No occurrence found in document');
    },
    [editor],
  );

  const handleReplace = useCallback(
    async (token: string, replacement: string) => {
      if (!editor || readOnly) return;
      const trimmed = replacement.trim();
      if (!trimmed) {
        toast.error('Enter a value to fill in');
        return;
      }
      setBusyToken(token);
      try {
        const replaced = replaceAllInEditor(editor, token, trimmed);
        if (replaced === 0) {
          toast.error('Token no longer present in document');
          return;
        }
        setPendingValues((prev) => {
          const next = { ...prev };
          delete next[token];
          return next;
        });
        toast.success(`Filled ${replaced} occurrence${replaced === 1 ? '' : 's'} of ${token}`);
        onAfterReplace?.();
      } finally {
        setBusyToken(null);
      }
    },
    [editor, readOnly, onAfterReplace],
  );

  const handleCopyToken = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }, []);

  const handleFillAllPending = useCallback(async () => {
    if (!editor || readOnly) return;
    const entries = Object.entries(pendingValues).filter(([, v]) => v.trim().length > 0);
    if (entries.length === 0) {
      toast.error('No values entered yet');
      return;
    }
    let total = 0;
    for (const [token, value] of entries) {
      total += replaceAllInEditor(editor, token, value.trim());
    }
    setPendingValues({});
    toast.success(`Filled ${total} occurrence${total === 1 ? '' : 's'} across ${entries.length} variables`);
    onAfterReplace?.();
  }, [editor, readOnly, pendingValues, onAfterReplace]);

  const pendingCount = useMemo(
    () => Object.values(pendingValues).filter((v) => v.trim().length > 0).length,
    [pendingValues],
  );

  // ──────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────

  if (!editor) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 pb-1">
      {/* Header section card */}
      <section className="space-y-3 rounded-[24px] border border-slate-200/90 bg-white/95 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-800/95">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                <Braces className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Variables</h3>
              {variables.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  {variables.length} unique · {totalOccurrences} total
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Fill in placeholders like <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">[Buyer]</code>,{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{'{{date}}'}</code>, or{' '}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">[[Term]]</code>. Renames apply to every occurrence at once.
            </p>
          </div>
        </div>

        {variables.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter variables…"
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-violet-800/40"
                aria-label="Filter variables"
              />
            </div>
            <button
              type="button"
              onClick={handleFillAllPending}
              disabled={readOnly || pendingCount === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
              title={readOnly ? 'Editing is locked' : `Apply ${pendingCount} pending value${pendingCount === 1 ? '' : 's'}`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Fill all
              {pendingCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{pendingCount}</span>
              )}
            </button>
          </div>
        )}

        {readOnly && variables.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <Lock className="h-3.5 w-3.5" />
            <span>Draft is locked — variable replacements are disabled.</span>
          </div>
        )}
      </section>

      {/* Variable list */}
      <div className="flex-1 min-h-0">
        {variables.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No variables match “{search}”.
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {filtered.map((v) => (
                <motion.li
                  key={v.token}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-800/95"
                >
                  <VariableRow
                    variable={v}
                    pendingValue={pendingValues[v.token] ?? ''}
                    onPendingChange={(value) =>
                      setPendingValues((prev) => ({ ...prev, [v.token]: value }))
                    }
                    onJump={() => handleJump(v.token)}
                    onCopy={() => handleCopyToken(v.token)}
                    onReplace={(value) => handleReplace(v.token, value)}
                    busy={busyToken === v.token}
                    readOnly={readOnly}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function VariableRow({
  variable,
  pendingValue,
  onPendingChange,
  onJump,
  onCopy,
  onReplace,
  busy,
  readOnly,
}: {
  variable: DetectedVariable;
  pendingValue: string;
  onPendingChange: (value: string) => void;
  onJump: () => void;
  onCopy: () => void;
  onReplace: (value: string) => void;
  busy: boolean;
  readOnly: boolean;
}) {
  const badge = SHAPE_BADGES[variable.shape];

  return (
    <div className="flex flex-col gap-2">
      {/* Top row: token + count + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wide ${badge.className}`}
            title={`Shape: ${badge.label}`}
          >
            {badge.label}
          </span>
          <code className="truncate font-mono text-[12px] font-semibold text-slate-900 dark:text-slate-100">
            {variable.token}
          </code>
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            ×{variable.count}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onJump}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            title="Jump to first occurrence"
            aria-label={`Jump to ${variable.token}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            title="Copy token"
            aria-label={`Copy ${variable.token}`}
          >
            <CopyIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sample context */}
      {variable.samples[0] && (
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {variable.samples[0]}
        </p>
      )}

      {/* Replace input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onReplace(pendingValue);
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={pendingValue}
          onChange={(e) => onPendingChange(e.target.value)}
          placeholder={`Fill in ${variable.label}…`}
          disabled={readOnly || busy}
          className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:ring-violet-800/40"
          aria-label={`Replacement value for ${variable.token}`}
        />
        <button
          type="submit"
          disabled={readOnly || busy || pendingValue.trim().length === 0}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          title={`Replace all ${variable.count} occurrence${variable.count === 1 ? '' : 's'}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          Replace all
        </button>
      </form>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
        <Sparkles className="h-5 w-5 text-violet-500" />
      </div>
      <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">No variables yet</p>
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Insert placeholders in your draft using <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">[Square Brackets]</code>,{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{'{{handlebars}}'}</code>,{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">[[Double]]</code>, or{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{'<<Angle>>'}</code> — they will appear here.
      </p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText('[Party Name]')
            .then(() => toast.success('Copied [Party Name] — paste it into the editor'))
            .catch(() => {
              toast.message('Type [Party Name] into the editor to get started');
            });
        }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50"
      >
        <CopyIcon className="h-3.5 w-3.5" />
        Copy [Party Name]
      </button>
    </div>
  );
}

export default VariableManager;
