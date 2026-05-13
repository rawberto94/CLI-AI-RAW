import { describe, expect, it } from 'vitest';

import { shouldApplyExtractedContractTitle } from '../display-name';

describe('shouldApplyExtractedContractTitle', () => {
  it('preserves the uploaded file name as the displayed contract name', () => {
    expect(shouldApplyExtractedContractTitle({
      contractTitle: 'Supplier Agreement.pdf',
      originalName: 'Supplier Agreement.pdf',
      fileName: 'Supplier Agreement.pdf',
    })).toBe(false);
  });

  it('preserves the original upload name even when no custom title exists', () => {
    expect(shouldApplyExtractedContractTitle({
      contractTitle: null,
      originalName: 'Uploaded Master Services Agreement.pdf',
      fileName: 'Uploaded Master Services Agreement.pdf',
    })).toBe(false);
  });

  it('allows an extracted title only for records without a displayable name', () => {
    expect(shouldApplyExtractedContractTitle({
      contractTitle: null,
      originalName: null,
      fileName: null,
    })).toBe(true);
  });
});