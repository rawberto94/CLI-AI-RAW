import { describe, expect, it } from 'vitest';

import {
  buildPersistedContractTextFields,
  MAX_SEARCHABLE_TEXT_LENGTH,
} from '../src/contract-text';

describe('buildPersistedContractTextFields', () => {
  it('keeps rawText and searchableText identical for short content', () => {
    const text = 'Master Services Agreement for platform support';

    expect(buildPersistedContractTextFields(text)).toEqual({
      rawText: text,
      searchableText: text,
    });
  });

  it('truncates searchableText without changing rawText for long content', () => {
    const text = 'A'.repeat(MAX_SEARCHABLE_TEXT_LENGTH + 128);

    const result = buildPersistedContractTextFields(text);

    expect(result.rawText).toHaveLength(MAX_SEARCHABLE_TEXT_LENGTH + 128);
    expect(result.searchableText).toHaveLength(MAX_SEARCHABLE_TEXT_LENGTH);
    expect(result.searchableText).toBe(text.slice(0, MAX_SEARCHABLE_TEXT_LENGTH));
  });
});