import { describe, expect, it } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import {
  applyExistingClauseDuplicateWarnings,
  normalizeClauseImportRows,
  parseClauseImportFile,
  parseClauseImportJson,
} from '../clause-file-parser';

describe('clause-file-parser', () => {
  it('parses CSV rows with clause-specific headers', async () => {
    const file = new NodeFile([
      'title,content,category,riskLevel,tags,isStandard,isMandatory,isNegotiable,jurisdiction,contractTypes\n',
      'Standard Confidentiality,"Each party shall protect confidential information.",confidentiality,high,"nda,confidentiality",true,true,false,GLOBAL,"MSA,NDA"\n',
    ], 'clauses.csv', { type: 'text/csv' }) as File;

    const result = await parseClauseImportFile(file);

    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.rows[0]).toMatchObject({
      title: 'Standard Confidentiality',
      category: 'CONFIDENTIALITY',
      riskLevel: 'HIGH',
      isStandard: true,
      isMandatory: true,
      isNegotiable: false,
      jurisdiction: 'GLOBAL',
    });
    expect(result.rows[0]?.tags).toEqual(['nda', 'confidentiality']);
    expect(result.rows[0]?.contractTypes).toEqual(['MSA', 'NDA']);
  });

  it('parses JSON arrays and reports missing required fields', () => {
    const result = parseClauseImportJson([
      {
        name: 'Payment Terms',
        clause: 'Invoices are payable within thirty days of receipt.',
        type: 'payment',
      },
      {
        title: 'Broken Clause',
        content: '',
        category: '',
      },
    ]);

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(1);
    expect(result.errorRows).toBe(1);
    expect(result.rows[0]?.title).toBe('Payment Terms');
    expect(result.rows[0]?.content).toContain('Invoices are payable');
    expect(result.rows[0]?.category).toBe('PAYMENT');
    expect(result.rows[1]?.errors).toEqual(['Content is required', 'Category is required']);
  });

  it('marks duplicate titles within an import and existing library duplicates', () => {
    const result = normalizeClauseImportRows([
      { title: 'Indemnity', content: 'First indemnity clause language.', category: 'indemnification' },
      { title: 'Indemnity', content: 'Second indemnity clause language.', category: 'indemnification' },
      { title: 'Existing', content: 'Existing clause language.', category: 'general' },
    ]);

    const withExistingDuplicates = applyExistingClauseDuplicateWarnings(result, new Set(['existing']));

    expect(withExistingDuplicates.duplicateRows).toBe(2);
    expect(withExistingDuplicates.rows[1]?.duplicateReason).toBe('Duplicate title in this file');
    expect(withExistingDuplicates.rows[2]?.duplicateReason).toBe('Already exists in the clause library');
  });
});