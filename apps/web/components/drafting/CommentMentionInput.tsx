'use client';

/**
 * CommentMentionInput
 *
 * A lightweight comment input with @mention autocomplete.
 * - Detects an open `@token` (last word starts with `@` and contains no space)
 * - Renders a small popup of matching team members below the input
 * - Up/Down arrow keys navigate, Enter inserts the mention
 * - Pressing Enter without an open token submits via `onSubmit`
 *
 * The mention is inserted as `@Display Name` (plus a trailing space). We do
 * not embed user IDs in the rendered comment because the server schema does
 * not support mention metadata yet; this is presentational, parsed back via
 * `formatCommentBody` (see below).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface MentionMember {
  id: string;
  name: string;
  email: string;
}

interface CommentMentionInputProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  members: MentionMember[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  /** When true, render as a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
}

function getOpenMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  if (caret === 0) return null;
  // Walk back from the caret to find an `@` that starts a word.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '@') {
      // Must be at start of input or preceded by whitespace.
      if (i === 0 || /\s/.test(text[i - 1] ?? '')) {
        const query = text.slice(i + 1, caret);
        // Cancel if the query already contains whitespace.
        if (/\s/.test(query)) return null;
        return { start: i, query };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i -= 1;
  }
  return null;
}

export function CommentMentionInput({
  value,
  onChange,
  onSubmit,
  members,
  placeholder,
  ariaLabel,
  disabled,
  className,
  size = 'md',
  multiline = false,
}: CommentMentionInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState<number>(value.length);
  const [highlight, setHighlight] = useState<number>(0);

  const open = useMemo(() => getOpenMentionQuery(value, caret), [value, caret]);

  const matches = useMemo(() => {
    if (!open) return [] as MentionMember[];
    const q = open.query.toLowerCase();
    if (!q) return members.slice(0, 6);
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [open, members]);

  useEffect(() => {
    setHighlight(0);
  }, [open?.query, matches.length]);

  const insertMention = useCallback(
    (member: MentionMember) => {
      if (!open) return;
      const before = value.slice(0, open.start);
      const after = value.slice(caret);
      const inserted = `@${member.name} `;
      const next = `${before}${inserted}${after}`;
      onChange(next);
      const nextCaret = (before + inserted).length;
      // Defer to next tick so the DOM input has the new value.
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(nextCaret, nextCaret);
          } catch { /* some browsers */ }
          setCaret(nextCaret);
        }
      });
    },
    [open, value, caret, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (open && matches.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setHighlight((h) => (h + 1) % matches.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setHighlight((h) => (h - 1 + matches.length) % matches.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertMention(matches[highlight]);
          return;
        }
        if (e.key === 'Escape') {
          // Force close by inserting a space-like cancel; simplest is to move caret beyond.
          e.preventDefault();
          setCaret(value.length);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        // Submit only when no popup is open.
        if (!multiline) {
          e.preventDefault();
          onSubmit();
        } else if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onSubmit();
        }
      }
    },
    [open, matches, highlight, insertMention, onSubmit, value.length, multiline],
  );

  const baseInputClass =
    size === 'sm'
      ? 'flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100'
      : 'flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className={`relative flex-1 ${className ?? ''}`}>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          rows={3}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? value.length)}
          onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? value.length)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          className={baseInputClass}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyUp={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? value.length)}
          onClick={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? value.length)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          className={baseInputClass}
        />
      )}

      {open && matches.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {matches.map((member, idx) => (
            <button
              key={member.id}
              type="button"
              role="option"
              aria-selected={idx === highlight}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertMention(member)}
              onMouseEnter={() => setHighlight(idx)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                idx === highlight
                  ? 'bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-200'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50'
              }`}
            >
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-200">
                {member.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 truncate">
                <span className="font-medium">{member.name}</span>
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{member.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * formatCommentBody — render plain comment text, highlighting `@Name`
 * patterns where `Name` exactly matches a known team member name. Returns a
 * React fragment of strings interleaved with mention chips.
 */
export function formatCommentBody(text: string, members: MentionMember[]): React.ReactNode {
  if (!text) return null;
  if (!members.length) return text;

  // Build a regex that matches any known member name preceded by `@` and
  // followed by a non-word boundary. Sort by length desc so longer names
  // win over shorter overlaps.
  const escaped = members
    .map((m) => m.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return text;
  const pattern = new RegExp(`@(${escaped.join('|')})(?![\\w])`, 'g');

  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) out.push(text.slice(lastIdx, match.index));
    out.push(
      <span
        key={`m${key++}`}
        className="inline-flex items-center rounded bg-violet-100 px-1 py-px text-[0.95em] font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
      >
        @{match[1]}
      </span>,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out;
}
