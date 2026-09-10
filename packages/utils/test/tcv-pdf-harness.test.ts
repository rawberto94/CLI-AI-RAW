import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessCriticalContractEvidence } from '../src/contract-extraction';

const FIXTURE_DIR = join(__dirname, '../../../fixtures/tcv');

describe('TCV PDF harness', () => {
  it('skips when no labeled PDFs are present', () => {
    if (!existsSync(FIXTURE_DIR)) {
      expect(true).toBe(true);
      return;
    }
    const pdfs = readdirSync(FIXTURE_DIR).filter((name) => name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      expect(true).toBe(true);
      return;
    }
    for (const pdf of pdfs) {
      const expectedPath = join(FIXTURE_DIR, pdf.replace(/\.pdf$/i, '.expected.json'));
      if (!existsSync(expectedPath)) continue;
      const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as {
        totalValue: number;
        currency: string | null;
        text: string;
      };
      const result = assessCriticalContractEvidence(expected.text);
      expect(result.metadata.totalValue).toBe(expected.totalValue);
      expect(result.metadata.currency).toBe(expected.currency);
    }
  });
});
