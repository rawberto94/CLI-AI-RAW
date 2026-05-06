/**
 * SuggestionMark — a TipTap inline mark used to render track-changes style
 * additions and deletions in the drafting editor.
 *
 * Rendering rules:
 *  - kind: 'ins' → green underline, rendered as <ins>
 *  - kind: 'del' → red strikethrough, rendered as <del>
 *
 * The mark also carries `author` and `suggestionId` so we can group an
 * insertion with its paired deletion (one logical "change") and accept or
 * reject them together.
 *
 * Persistence is automatic: the marks survive HTML round-trips through the
 * existing draft autosave because <ins>/<del> are preserved by both TipTap's
 * serializer and the sanitizer used when loading initial content.
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export interface SuggestionMarkOptions {
  /** Class applied in addition to the kind-specific class. */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestionMark: {
      setSuggestionMark: (attrs: { kind: 'ins' | 'del'; author?: string; suggestionId?: string }) => ReturnType;
      unsetSuggestionMark: () => ReturnType;
    };
  }
}

export const SuggestionMark = Mark.create<SuggestionMarkOptions>({
  name: 'suggestionMark',

  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      kind: {
        default: 'ins',
        parseHTML: (el) => el.getAttribute('data-kind') || (el.tagName.toLowerCase() === 'del' ? 'del' : 'ins'),
        renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
      },
      suggestionId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-suggestion-id'),
        renderHTML: (attrs) => (attrs.suggestionId ? { 'data-suggestion-id': attrs.suggestionId } : {}),
      },
      author: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-author'),
        renderHTML: (attrs) => (attrs.author ? { 'data-author': attrs.author } : {}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'ins[data-suggestion-id]' },
      { tag: 'del[data-suggestion-id]' },
      { tag: 'ins' },
      { tag: 'del' },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const kind = (mark.attrs.kind === 'del' ? 'del' : 'ins') as 'ins' | 'del';
    const cls = kind === 'ins' ? 'contigo-suggestion-ins' : 'contigo-suggestion-del';
    return [
      kind,
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: cls }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestionMark:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      unsetSuggestionMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

export default SuggestionMark;
