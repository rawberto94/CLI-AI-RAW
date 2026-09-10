import { describe, expect, it } from 'vitest';
import {
  documentNumberFromFileName,
  isOpaqueDocumentNumber,
  resolveDocumentNumber,
} from '../../document-number';

describe('documentNumberFromFileName', () => {
  it('strips path and extension', () => {
    expect(documentNumberFromFileName('MSA_Acme_2026.pdf')).toBe('MSA_Acme_2026');
    expect(documentNumberFromFileName('/tmp/foo bar (1).docx')).toBe('foo_bar_1');
  });

  it('returns empty for missing names', () => {
    expect(documentNumberFromFileName('')).toBe('');
    expect(documentNumberFromFileName(null)).toBe('');
  });
});

describe('resolveDocumentNumber', () => {
  it('prefers extracted number over filename', () => {
    expect(resolveDocumentNumber({
      extracted: 'CTR-441',
      fileName: 'scan.pdf',
      contractId: 'clabcdefghijklmnopqrstuv',
    })).toBe('CTR-441');
  });

  it('does not use a cuid as the public id', () => {
    expect(resolveDocumentNumber({
      extracted: 'clabcdefghijklmnopqrstuv',
      fileName: 'NDA_Supplier.pdf',
      contractId: 'clabcdefghijklmnopqrstuv',
    })).toBe('NDA_Supplier');
  });
});

describe('isOpaqueDocumentNumber', () => {
  it('flags cuids', () => {
    expect(isOpaqueDocumentNumber('clabcdefghijklmnopqrstuv')).toBe(true);
    expect(isOpaqueDocumentNumber('MSA-2026-01')).toBe(false);
  });
});
