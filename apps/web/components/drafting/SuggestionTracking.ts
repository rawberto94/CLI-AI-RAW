/**
 * SuggestionTracking — TipTap extension that, when enabled, intercepts
 * text-level edits and converts them into suggestion marks (paired
 * <ins>/<del>) so the editor behaves like a track-changes word processor
 * for human keystrokes.
 *
 * Scope: handles single-step ReplaceStep transactions (typing, backspace,
 * delete, simple paste-replace). Compound transactions (multi-step
 * autocomplete, list/structure manipulations, mark toggles) are left
 * untouched to avoid corrupting structural edits.
 *
 * Coordination with the in-place AI rewrite flow: the AI rewrite path
 * already inserts pre-marked <ins>/<del> spans. This extension detects
 * that the inserted content already carries a suggestion mark and skips
 * re-marking, so the two paths compose cleanly.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { ReplaceStep } from 'prosemirror-transform';
import { Fragment, Slice, type Node as PMNode, type MarkType } from 'prosemirror-model';

export interface SuggestionTrackingOptions {
  /** Live readback so the toggle can flip without recreating the extension. */
  isEnabled: () => boolean;
  /** Display name to attribute new suggestions to. */
  getAuthor: () => string;
}

const suggestionTrackingPluginKey = new PluginKey('contigoSuggestionTracking');

function generateSuggestionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Walk a fragment and re-mark every text node so the existing
 * suggestionMark (if any) is replaced with the supplied attrs while every
 * other mark is preserved.
 */
function rewriteSuggestionMark(
  fragment: Fragment,
  markType: MarkType,
  attrs: { kind: 'ins' | 'del'; author: string; suggestionId: string },
): Fragment {
  const newMark = markType.create(attrs);
  const mapNode = (node: PMNode): PMNode => {
    if (node.isText) {
      const others = node.marks.filter((m) => m.type !== markType);
      return node.mark([...others, newMark]) as PMNode;
    }
    if (node.content.size === 0) return node;
    const next: PMNode[] = [];
    node.content.forEach((child) => {
      next.push(mapNode(child));
    });
    return node.copy(Fragment.fromArray(next));
  };
  const out: PMNode[] = [];
  fragment.forEach((child) => {
    out.push(mapNode(child));
  });
  return Fragment.fromArray(out);
}

export const SuggestionTracking = Extension.create<SuggestionTrackingOptions>({
  name: 'suggestionTracking',

  addOptions() {
    return {
      isEnabled: () => false,
      getAuthor: () => 'You',
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin({
        key: suggestionTrackingPluginKey,
        appendTransaction: (transactions, oldState, newState) => {
          if (!opts.isEnabled()) return null;
          if (transactions.some((t) => t.getMeta(suggestionTrackingPluginKey))) return null;
          // Only act when the document changed.
          const docTr = transactions.find((t) => t.docChanged);
          if (!docTr) return null;
          // Skip transactions tagged as remote/history/programmatic if they
          // aren't user-driven typing. We accept the typical input and
          // backspace cases by keeping the constraint to exactly one step.
          if (docTr.steps.length !== 1) return null;
          const step = docTr.steps[0];
          if (!(step instanceof ReplaceStep)) return null;

          const markType = newState.schema.marks.suggestionMark;
          if (!markType) return null;

          const stepAny = step as ReplaceStep & { from: number; to: number; slice: Slice };
          const oldFrom = stepAny.from;
          const oldTo = stepAny.to;
          const insertedSize = stepAny.slice?.size ?? 0;

          const isPureInsert = oldFrom === oldTo && insertedSize > 0;
          const isPureDelete = oldTo > oldFrom && insertedSize === 0;
          const isReplace = oldTo > oldFrom && insertedSize > 0;
          if (!isPureInsert && !isPureDelete && !isReplace) return null;

          const sid = generateSuggestionId();
          const author = opts.getAuthor() || 'You';

          // Pure insert — typing a character or pasting fresh content.
          if (isPureInsert) {
            const newFrom = oldFrom;
            const newTo = oldFrom + insertedSize;
            // If the inserted slice already carries a suggestion mark
            // (e.g. from the AI rewrite path), don't double-mark.
            let alreadyMarked = false;
            newState.doc.nodesBetween(newFrom, newTo, (node) => {
              if (alreadyMarked) return false;
              if (node.isText && node.marks.some((m) => m.type === markType)) {
                alreadyMarked = true;
                return false;
              }
              return true;
            });
            if (alreadyMarked) return null;

            const tr = newState.tr;
            tr.setMeta(suggestionTrackingPluginKey, true);
            tr.addMark(newFrom, newTo, markType.create({ kind: 'ins', author, suggestionId: sid }));
            return tr;
          }

          // Pure delete — backspace / Delete / cut / select+delete.
          if (isPureDelete) {
            const deletedSlice = oldState.doc.slice(oldFrom, oldTo);
            // If everything that was deleted was already marked as `ins`
            // by a prior pending suggestion, just allow the delete (the
            // user is removing their own pending insert).
            let allWereIns = true;
            deletedSlice.content.descendants((node) => {
              if (!node.isText) return true;
              const sm = node.marks.find((m) => m.type === markType);
              if (!sm || sm.attrs.kind !== 'ins') {
                allWereIns = false;
                return false;
              }
              return true;
            });
            if (allWereIns) return null;

            const fragment = rewriteSuggestionMark(deletedSlice.content, markType, {
              kind: 'del',
              author,
              suggestionId: sid,
            });
            const reinsertSlice = new Slice(fragment, deletedSlice.openStart, deletedSlice.openEnd);

            const tr = newState.tr;
            tr.setMeta(suggestionTrackingPluginKey, true);
            // Re-insert the deleted content (now marked as del) at the
            // position where it used to be in the new doc, which is
            // simply oldFrom.
            tr.replace(oldFrom, oldFrom, reinsertSlice);
            return tr;
          }

          // Replace — user selected a range and typed/pasted over it.
          if (isReplace) {
            const newFrom = oldFrom;
            const newTo = oldFrom + insertedSize;

            // Mark the freshly inserted content as ins (skip if already
            // bears a suggestion mark from the AI rewrite path).
            let alreadyMarked = false;
            newState.doc.nodesBetween(newFrom, newTo, (node) => {
              if (alreadyMarked) return false;
              if (node.isText && node.marks.some((m) => m.type === markType)) {
                alreadyMarked = true;
                return false;
              }
              return true;
            });

            const tr = newState.tr;
            tr.setMeta(suggestionTrackingPluginKey, true);
            if (!alreadyMarked) {
              tr.addMark(
                newFrom,
                newTo,
                markType.create({ kind: 'ins', author, suggestionId: sid }),
              );
            }

            // Re-insert the deleted slice (marked del) immediately before
            // the (now ins-marked) inserted content. tr.insert at newFrom
            // pushes the ins content forward.
            const deletedSlice = oldState.doc.slice(oldFrom, oldTo);
            // Skip resurrecting if the deleted region was entirely
            // pending ins from the same author (treat as withdraw).
            let allWereIns = true;
            deletedSlice.content.descendants((node) => {
              if (!node.isText) return true;
              const sm = node.marks.find((m) => m.type === markType);
              if (!sm || sm.attrs.kind !== 'ins') {
                allWereIns = false;
                return false;
              }
              return true;
            });
            if (!allWereIns) {
              const fragment = rewriteSuggestionMark(deletedSlice.content, markType, {
                kind: 'del',
                author,
                suggestionId: sid,
              });
              tr.insert(newFrom, fragment);
            }
            return tr;
          }

          return null;
        },
      }),
    ];
  },
});

export default SuggestionTracking;
