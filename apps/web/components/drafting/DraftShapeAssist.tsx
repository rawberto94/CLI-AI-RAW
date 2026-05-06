/**
 * DraftShapeAssist
 * ---------------------------------------------------------------------------
 * "Shape assistant" — a living checklist that continuously scans the current
 * draft and surfaces concrete, one-click actions the AI can take to improve
 * it. Unlike a chat, this is a structured, always-visible companion that
 * turns the document into a worklist:
 *
 *   • Unfilled placeholders           (`[___]`, `[TBD]`, `{{name}}`, `[Party]`)
 *   • Thin sections                   (headings whose body is under 60 words)
 *   • Undefined capitalised terms     (used as defined terms but never defined)
 *   • Missing blueprint sections      (passed in from the canvas)
 *
 * Each finding has a one-click CTA that sends a targeted prompt into the
 * existing assistant chat stream so the AI can either suggest a value,
 * expand a section, add a missing definition, or draft a missing section.
 *
 * This is intentionally deterministic (regex-based) so it updates in real
 * time without LLM calls — the AI only runs when the user clicks a CTA.
 *
 * Designed to live inside the "assistant" tab of the CopilotDraftingCanvas,
 * above the free-form chat.
 */

'use client';

import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { toast } from 'sonner';
import {
  Wand2, Sparkles, Variable, BookMarked, FileWarning, ChevronDown, ChevronUp,
  ArrowRight, CheckCircle2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  editor: Editor | null;
  /** Re-compute when this version changes (debounced doc version from canvas). */
  contentVersion: number;
  contractTypeKey: string;
  /** Fires a free-form prompt into the assistant chat stream. */
  onAskAi: (prompt: string) => void;
}

// ---------------------------------------------------------------------------
// Scanners
// ---------------------------------------------------------------------------

/**
 * Common placeholder patterns that survive from templates or are inserted by
 * the drafter on purpose. Capture groups keep the raw token for display.
 */
const PLACEHOLDER_PATTERNS: Array<{ re: RegExp; kind: string }> = [
  { re: /\{\{\s*([A-Za-z0-9_ .-]+?)\s*\}\}/g, kind: 'variable' }, // {{partyA}}
  { re: /\[\s*(TBD|TODO|FIXME|___+|…+)\s*\]/gi, kind: 'tbd' },     // [TBD], [___], [TODO]
  { re: /\[\s*([A-Z][A-Za-z0-9 ./&-]{1,40})\s*\]/g, kind: 'field' }, // [Effective Date], [Party Name]
];

interface PlaceholderHit {
  token: string;
  kind: string;
  context: string;
  count: number;
}

function scanPlaceholders(text: string): PlaceholderHit[] {
  const byToken = new Map<string, PlaceholderHit>();
  for (const { re, kind } of PLACEHOLDER_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const full = m[0];
      // Skip obviously-legitimate bracketed content like [1] [a] or [see Schedule A].
      if (kind === 'field' && /^\[\s*(see|schedule|exhibit|annex|schedule\s+[a-z])/i.test(full)) continue;
      if (kind === 'field' && /^\[\s*[ivxlc]+\s*\]$/i.test(full)) continue; // roman numerals
      if (kind === 'field' && /^\[\s*\d+\s*\]$/.test(full)) continue;       // [1]
      const key = `${kind}::${full.toLowerCase()}`;
      const existing = byToken.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      // Capture ~60 chars of surrounding context for the CTA prompt.
      const start = Math.max(0, m.index - 40);
      const end = Math.min(text.length, m.index + full.length + 40);
      const context = text.slice(start, end).replace(/\s+/g, ' ').trim();
      byToken.set(key, { token: full, kind, context, count: 1 });
    }
  }
  return Array.from(byToken.values()).slice(0, 12);
}

/** Sections whose body is too thin to be meaningful. */
function scanThinSections(
  editor: Editor | null,
): Array<{ title: string; wordCount: number; startPos: number }> {
  if (!editor) return [];
  const headings: Array<{ title: string; startPos: number }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = typeof node.attrs.level === 'number' ? node.attrs.level : 1;
      if (level <= 3 && node.textContent.trim()) {
        headings.push({ title: node.textContent.trim(), startPos: pos });
      }
    }
  });
  const results: Array<{ title: string; wordCount: number; startPos: number }> = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].startPos;
    const end = i + 1 < headings.length ? headings[i + 1].startPos : editor.state.doc.content.size;
    const text = editor.state.doc.textBetween(start, end, '\n').replace(headings[i].title, '');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (words < 60) {
      results.push({ title: headings[i].title, wordCount: words, startPos: start });
    }
  }
  return results.slice(0, 8);
}

/**
 * "Capitalised term used but not defined" heuristic:
 * - Find capitalised multi-word phrases used as defined terms
 *   (2+ occurrences, Title Case, 1–4 words).
 * - Exclude terms that have a definition cue nearby
 *   (`"X" means`, `X shall mean`, `X: ...` near first use).
 */
function scanUndefinedTerms(text: string): Array<{ term: string; uses: number }> {
  const candidateRe = /\b((?:[A-Z][a-zA-Z]+)(?:\s[A-Z][a-zA-Z]+){0,3})\b/g;
  const counts = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = candidateRe.exec(text)) !== null) {
    const term = m[1].trim();
    if (term.split(/\s+/).length < 2) continue; // single capitalised words are too noisy (Party, Seller…)
    if (term.length > 60) continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  const STOP_PREFIXES = /^(The|This|An?|These|Those|If|Each|Any|All|Both|Either|Neither|In|On|At|For|Of|By|To|With|Without|From)\s/i;
  const STOP_TERMS = new Set([
    'United States', 'New York', 'Section One', 'Section Two', 'Schedule A', 'Schedule B',
    'Exhibit A', 'Exhibit B', 'Article I', 'Article II',
  ]);
  const results: Array<{ term: string; uses: number }> = [];
  for (const [term, uses] of counts.entries()) {
    if (uses < 2) continue;
    if (STOP_PREFIXES.test(term)) continue;
    if (STOP_TERMS.has(term)) continue;
    // Definition heuristic: look for `"term" means`, `term shall mean`, or
    // `term:` in contexts that look like a definition.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const definitionRe = new RegExp(
      `(?:"?${escaped}"?\\s+(?:means|shall\\s+mean|refers\\s+to)|"${escaped}"\\s+(?:has\\s+the\\s+meaning))`,
      'i',
    );
    if (definitionRe.test(text)) continue;
    results.push({ term, uses });
  }
  results.sort((a, b) => b.uses - a.uses);
  return results.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Editor deeplink helper
// ---------------------------------------------------------------------------

/**
 * Find `needle` in the editor's doc and move the selection + scroll there.
 *
 * ProseMirror (TipTap) positions are NOT the same as string indices: each node
 * contributes +1 for its opening and +1 for its closing, and text characters
 * count 1 each. So `textBetween` + `indexOf + 1` (our old naive version) was
 * only correct for single-paragraph documents and silently drifted as soon as
 * there were multiple blocks.
 *
 * The reliable way is to walk the real doc, and for every text node compare
 * the needle against the node's `textContent`. When we find a match we know
 * the exact starting position (`nodePos + offsetInNode`).
 *
 * Returns true if the needle was located and the selection was moved.
 */
function focusInEditor(editor: Editor | null, needle: string): boolean {
  if (!editor || !needle) return false;
  try {
    const doc = editor.state.doc;
    let found: { from: number; to: number } | null = null;
    doc.descendants((node, pos) => {
      if (found) return false; // short-circuit walk
      if (!node.isText || !node.text) return true;
      const nodeText = node.text;
      const offset = nodeText.indexOf(needle);
      if (offset >= 0) {
        const from = pos + offset;
        found = { from, to: from + needle.length };
        return false;
      }
      return true;
    });
    if (!found) return false;
    editor.chain().focus().setTextSelection(found).scrollIntoView().run();
    return true;
  } catch {
    return false;
  }
}

/**
 * Move selection to an absolute document position (used for thin-section
 * CTAs — we already know the heading's startPos from the scanner). We clamp
 * to valid positions so we never throw on stale positions after edits.
 */
function focusAtPos(editor: Editor | null, pos: number): boolean {
  if (!editor) return false;
  try {
    const docSize = editor.state.doc.content.size;
    const target = Math.max(1, Math.min(pos, docSize - 1));
    editor.chain().focus().setTextSelection(target).scrollIntoView().run();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftShapeAssist({
  editor,
  contentVersion,
  contractTypeKey,
  onAskAi,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  const text = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    contentVersion; // force recompute
    return editor?.getText() || '';
  }, [editor, contentVersion]);

  const placeholders = useMemo(() => scanPlaceholders(text), [text]);
  const thinSections = useMemo(() => scanThinSections(editor), [editor, contentVersion]);
  const undefinedTerms = useMemo(() => scanUndefinedTerms(text), [text]);

  const totalIssues =
    placeholders.length +
    thinSections.length +
    undefinedTerms.length;

  // All clear — show a quiet single-line badge rather than a full-size card,
  // so when the draft is in good shape the panel gets out of the way.
  if (totalIssues === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/70 px-3 py-1 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Draft looks clean — no placeholders, thin sections, or undefined terms.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white/95 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)] dark:border-violet-900/60 dark:from-violet-950/30 dark:to-slate-900/80">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-start justify-between gap-3 text-left focus-visible:outline-none"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700/80 dark:text-violet-300/80">
            Shape this draft
          </p>
          <p className="mt-1 text-base font-semibold tracking-[-0.01em] text-slate-950 dark:text-slate-100">
            {totalIssues} thing{totalIssues === 1 ? '' : 's'} the AI can help with right now
          </p>
          <p className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
            Each item below is a one-click hand-off to the assistant — we send the
            relevant context so the answer lands back in this conversation.
          </p>
        </div>
        <span className="mt-1 shrink-0 rounded-full border border-violet-200/70 bg-white/90 p-1.5 text-violet-700 dark:border-violet-800 dark:bg-slate-900/80 dark:text-violet-300">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Placeholders */}
          {placeholders.length > 0 && (
            <Section
              icon={<Variable className="h-3.5 w-3.5" />}
              title="Placeholders to fill"
              hint="Values still bracketed in the draft."
              count={placeholders.length}
            >
              <div className="flex flex-wrap gap-1.5">
                {placeholders.map((p, idx) => (
                  <ActionPill
                    key={`${p.kind}-${idx}-${p.token}`}
                    label={p.token}
                    sub={p.count > 1 ? `${p.count}×` : undefined}
                    tone="amber"
                    onClick={() => {
                      const located = focusInEditor(editor, p.token);
                      if (!located) {
                        toast('Could not locate that placeholder in the draft — the answer will appear in chat.', { duration: 3500 });
                      }
                      onAskAi(
                        `The draft still contains the placeholder ${p.token}. Based on the surrounding context "${p.context}", suggest 2–3 realistic values I could use, explain the risk of each, and recommend one. If a value is already implied by other parts of the draft, pick that one verbatim.`,
                      );
                    }}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Thin sections */}
          {thinSections.length > 0 && (
            <Section
              icon={<FileWarning className="h-3.5 w-3.5" />}
              title="Sections that look thin"
              hint="Headings with less than ~60 words of body copy."
              count={thinSections.length}
            >
              <div className="flex flex-col gap-1.5">
                {thinSections.map((s, idx) => (
                  <ActionRow
                    key={`thin-${idx}`}
                    title={s.title}
                    sub={`${s.wordCount} word${s.wordCount === 1 ? '' : 's'} — may need expansion`}
                    cta="Expand with AI"
                    onClick={() => {
                      focusAtPos(editor, s.startPos + 1);
                      onAskAi(
                        `The "${s.title}" section of this ${contractTypeKey} draft currently has only ${s.wordCount} words of body copy. Expand it into a full, operative clause (3–6 sentences), matching the tone and numbering already in the document. Insert it via a block replace for that heading.`,
                      );
                    }}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Undefined terms */}
          {undefinedTerms.length > 0 && (
            <Section
              icon={<BookMarked className="h-3.5 w-3.5" />}
              title="Terms used but not defined"
              hint="Capitalised terms that look like defined terms, used 2+ times without a definition."
              count={undefinedTerms.length}
            >
              <div className="flex flex-wrap gap-1.5">
                {undefinedTerms.map((t, idx) => (
                  <ActionPill
                    key={`term-${idx}-${t.term}`}
                    label={t.term}
                    sub={`${t.uses} uses`}
                    tone="sky"
                    onClick={() => {
                      const located = focusInEditor(editor, t.term);
                      if (!located) {
                        toast(`Could not locate “${t.term}” in the draft — the answer will appear in chat.`, { duration: 3500 });
                      }
                      onAskAi(
                        `The term "${t.term}" is used ${t.uses} times in this ${contractTypeKey} draft without being defined. Draft a standard definition clause for it, suitable for inclusion in a Definitions section, and show me where to place it. Use the surrounding language of the draft as context.`,
                      );
                    }}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Missing blueprint sections are rendered by the "Drafting path"
              card below, which already tracks complete/next state. Keeping them
              there avoids duplicate UX. */}

          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3 w-3" />
            <span>
              This list updates as you type. The AI never edits the draft without
              your review — each click opens a suggestion in the chat.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  hint,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          {icon}
        </span>
        <p className="flex-1 text-[12px] font-semibold text-slate-900 dark:text-slate-100">
          {title}
          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {count}
          </span>
        </p>
      </div>
      <p className="mb-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{hint}</p>
      {children}
    </div>
  );
}

function ActionPill({
  label,
  sub,
  tone,
  onClick,
}: {
  label: string;
  sub?: string;
  tone: 'amber' | 'sky';
  onClick: () => void;
}) {
  const toneClasses =
    tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40'
      : 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/40';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${toneClasses}`}
      title="Ask AI to handle this"
    >
      <Wand2 className="h-3 w-3 opacity-70 group-hover:opacity-100" />
      <span className="max-w-[14rem] truncate font-mono text-[11px]">{label}</span>
      {sub && <span className="opacity-60">· {sub}</span>}
    </button>
  );
}

function ActionRow({
  title,
  sub,
  cta,
  onClick,
}: {
  title: string;
  sub?: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[12px] dark:border-slate-700/60 dark:bg-slate-900/50">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {sub && (
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}
