import { describe, expect, it } from 'vitest';

import { assessCriticalContractEvidence, assessContractTermEvidence, CONTRACT_DI_QUERY_FIELDS, CONTRACT_DI_QUERY_IDENTIFIERS, extractFinancialEvidence, isHumanTcvLocked, normalizeDIQueryAnswers, parseIsoDate, resolveTcvWinner, validateDIQueryAnswers } from '../src/contract-extraction';

describe('assessContractTermEvidence', () => {
  it('derives an end date from a two-year initial term', () => {
    const text = `This Mutual Non-Disclosure Agreement is effective as of January 1, 2024.
The initial term of this Agreement is two (2) years from the Effective Date.`;

    expect(assessContractTermEvidence(text, { effectiveDate: '2024-01-01' })).toMatchObject({
      derivedEndDate: '2026-01-01',
      initialTerm: {
        value: 2,
        unit: 'year',
        months: 24,
      },
      autoRenewal: false,
      evergreen: false,
    });
  });

  it('detects expiration stated relative to the effective date', () => {
    const text = `The agreement expires two years from the Effective Date unless earlier terminated.`;

    expect(assessContractTermEvidence(text, { effectiveDate: '2024-04-15' })).toMatchObject({
      derivedEndDate: '2026-04-15',
      initialTerm: {
        value: 2,
        unit: 'year',
      },
    });
  });

  it('prefers an explicit end date over duration arithmetic', () => {
    const text = `This Agreement shall remain in force for an initial term of three (3) years, until 31 March 2029.`;

    expect(assessContractTermEvidence(text, { effectiveDate: '2026-04-01' })).toMatchObject({
      derivedEndDate: '2029-03-31',
      initialTerm: {
        value: 3,
        unit: 'year',
      },
    });
  });

  it('separates renewal periods and notice from the initial term', () => {
    const text = `After the initial term, this Agreement shall renew automatically for successive 12 month renewal periods unless either party gives 60 days notice.`;

    const assessment = assessContractTermEvidence(text, { effectiveDate: '2024-01-01' });

    expect(assessment.initialTerm).toBeNull();
    expect(assessment.renewalTerm).toMatchObject({ value: 12, unit: 'month' });
    expect(assessment.autoRenewal).toBe(true);
    expect(assessment.noticePeriodDays).toBe(60);
  });
});

describe('extractFinancialEvidence', () => {
  it('prefers explicit aggregate TCV over an earlier milestone payment', () => {
    const text = `Payment milestone 1: USD 25,000 due upon contract execution.
Total Contract Value: USD 1.2 million for all services under this Supplier Agreement.`;

    expect(extractFinancialEvidence(text)).toMatchObject({
      totalValue: 1_200_000,
      currency: 'USD',
      bestCandidate: {
        kind: 'aggregate',
      },
    });
  });

  it('handles comma formatted aggregate values', () => {
    const text = `The aggregate consideration and total contract value shall not exceed $1,200,000.
The first installment of $25,000 is payable on kickoff.`;

    expect(extractFinancialEvidence(text).totalValue).toBe(1_200_000);
  });

  it('prefers a transaction fee over a smaller reimbursable expense cap', () => {
    const text = `3.1 Transaction Fee. The transaction fee shall amount to CHF 1.2 million.
3.2 Incentive Fee. The Client may pay an additional incentive fee of up to CHF 0.35 million.
3.3 Reimbursement of Expenses. Expenses are capped at CHF 25,000.`;

    expect(extractFinancialEvidence(text)).toMatchObject({
      totalValue: 1_200_000,
      currency: 'CHF',
    });
  });

  it('does not treat a lone milestone amount as total contract value', () => {
    const text = `Fees are payable in milestones of $25,000 each upon acceptance of each deliverable.`;

    expect(extractFinancialEvidence(text).totalValue).toBeNull();
  });

  it('does not treat a reimbursable expense cap as total contract value', () => {
    const text = `The Client shall reimburse AdvisoryFirm for reasonable, properly documented out-of-pocket expenses up to an aggregate cap of CHF 25,000.`;

    expect(extractFinancialEvidence(text).totalValue).toBeNull();
  });

  it('parses Swiss apostrophe thousands as TCV and does not sum installments', () => {
    const text = 'The total contract value is CHF 1\'200\'000 for the full term.';

    expect(extractFinancialEvidence(text)).toMatchObject({
      totalValue: 1_200_000,
      currency: 'CHF',
      bestCandidate: { kind: 'aggregate' },
    });
  });

  it('treats Fr. as CHF', () => {
    const text = 'The total contract value amounts to Fr. 250000 for the services.';
    expect(extractFinancialEvidence(text)).toMatchObject({
      totalValue: 250000,
      currency: 'CHF',
    });
  });

});

describe('resolveTcvWinner', () => {
  it('prefers a DI query aggregate over overview and invoice totals', () => {
    const winner = resolveTcvWinner({
      contractType: 'MSA',
      diQueryAnswers: {
        totalContractValue: 'CHF 1\'200\'000',
      },
      overviewTotal: 25000,
      invoiceTotal: 500,
      financialTotal: 800000,
    });
    expect(winner.source).toBe('di_query');
    expect(winner.value).toBe(1_200_000);
    expect(winner.currency).toBe('CHF');
  });

  it('does not use invoice totals for ordinary contracts', () => {
    const winner = resolveTcvWinner({
      contractType: 'MSA',
      invoiceTotal: 9_999,
      invoiceCurrency: 'USD',
    });
    expect(winner.source).toBe('none');
    expect(winner.value).toBeNull();
  });

  it('uses invoice total only for invoice documents', () => {
    const winner = resolveTcvWinner({
      contractType: 'INVOICE',
      invoiceTotal: 9_999,
      invoiceCurrency: 'USD',
    });
    expect(winner).toMatchObject({ source: 'invoice', value: 9999, currency: 'USD' });
  });

  it('picks Gesamtvertragswert over Haftung and Tagessatz', () => {
    const text = `
Dienstleistungsvertrag zwischen Contigo AG und Vendor GmbH.
Der Gesamtvertragswert beträgt CHF 1,200,000.
Die Haftung ist begrenzt auf CHF 2,000,000.
Honorartabelle: Senior Consultant Tagessatz CHF 1,400.
`;
    const winner = resolveTcvWinner({
      contractType: 'MSA',
      contractText: text,
      financialTotal: 2_000_000,
      overviewTotal: 1400,
    });
    expect(winner.value).toBe(1_200_000);
    expect(winner.currency).toBe('CHF');
    expect(winner.source).toBe('heuristic');
    expect(winner.quote).toMatch(/Gesamtvertragswert/i);
  });

  it('rejects a DI TCV that is clearly a liability cap', () => {
    const text = `
Die Haftung (Haftungsobergrenze) beträgt CHF 2,000,000.
Der Gesamtvertragswert beträgt CHF 1,200,000.
`;
    const winner = resolveTcvWinner({
      contractType: 'MSA',
      contractText: text,
      diQueryAnswers: {
        totalContractValue: 'CHF 2,000,000',
      },
    });
    expect(winner.value).toBe(1_200_000);
    expect(winner.source).toBe('heuristic');
  });

  it('does not use an LLM total with no supporting aggregate quote', () => {
    const winner = resolveTcvWinner({
      contractType: 'MSA',
      financialTotal: 999_999,
      overviewTotal: 888_888,
    });
    expect(winner.source).toBe('none');
    expect(winner.value).toBeNull();
  });

  it('locks human-saved TCV', () => {
    expect(isHumanTcvLocked({ tcvSource: 'human' })).toBe(true);
    expect(isHumanTcvLocked({ tcvSource: 'heuristic' })).toBe(false);
    expect(isHumanTcvLocked(null)).toBe(false);
  });
});

describe('normalizeDIQueryAnswers', () => {
  it('normalizes DI query answers into metadata and evidence', () => {
    const result = normalizeDIQueryAnswers({
      effectiveDate: 'March 9, 2026',
      expirationDate: 'March 9, 2028',
      totalContractValue: 'CHF 1.2 million',
      noticePeriod: '60 days before expiration',
      contractingParties: 'ClientCo AG and AdvisoryFirm Global Advisory Country X AG',
    });

    expect(result.metadata).toMatchObject({
      startDate: '2026-03-09',
      endDate: '2028-03-09',
      totalValue: 1_200_000,
      currency: 'CHF',
      noticePeriodDays: 60,
    });
    expect(result.metadata.parties).toEqual(['ClientCo AG', 'AdvisoryFirm Global Advisory Country X AG']);
    expect(result.evidence.map(item => item.field)).toContain('totalContractValue');
  });

  it('derives end date from DI effective date and initial duration when no explicit expiration answer exists', () => {
    const result = normalizeDIQueryAnswers({
      effectiveDate: 'March 9, 2026',
      initialTerm: '2 years from the Effective Date',
    });

    expect(result.metadata).toMatchObject({
      startDate: '2026-03-09',
      endDate: '2028-03-09',
      initialTerm: '2 years from the Effective Date',
    });
  });

  it('normalizes expanded critical-field lookup answers', () => {
    const result = normalizeDIQueryAnswers({
      contractTitle: 'Strategic Supply Agreement',
      contractType: 'Supplier Agreement',
      clientName: 'ClientCo AG',
      supplierName: 'Nordic Components GmbH',
      signatureStatus: 'Not signed; signature fields are blank.',
      signatureDate: 'not specified',
      autoRenewal: 'No, it does not automatically renew.',
      terminationClause: 'Either party may terminate with 90 days written notice.',
      liabilityCap: 'Liability is capped at CHF 500,000.',
      keyObligations: 'Supplier will deliver components according to the monthly forecast.',
    });

    expect(result.metadata).toMatchObject({
      title: 'Strategic Supply Agreement',
      contractType: 'Supplier Agreement',
      clientName: 'ClientCo AG',
      supplierName: 'Nordic Components GmbH',
      signatureStatus: 'unsigned',
      autoRenewal: false,
      terminationClause: 'Either party may terminate with 90 days written notice.',
      liabilityCap: 500_000,
      liabilityCapCurrency: 'CHF',
    });
    expect(result.metadata.signatureDate).toBeUndefined();
    expect(result.evidence.map(item => item.field)).toEqual(expect.arrayContaining(['clientName', 'supplierName', 'signatureStatus', 'liabilityCap']));
  });

  it('keeps the DI lookup set within a bounded query count', () => {
    expect(CONTRACT_DI_QUERY_FIELDS.length).toBeLessThanOrEqual(20);
    expect(CONTRACT_DI_QUERY_IDENTIFIERS.length).toBe(CONTRACT_DI_QUERY_FIELDS.length);
  });

  it('uses API-compliant identifiers, not full sentences', () => {
    expect(CONTRACT_DI_QUERY_IDENTIFIERS[0]).toBe('contractTitle');
    expect(CONTRACT_DI_QUERY_IDENTIFIERS).toContain('contractCurrency');
    expect(CONTRACT_DI_QUERY_IDENTIFIERS.every((id) => /^[\p{L}\p{M}\p{N}_]{1,64}$/u.test(id))).toBe(true);
  });

  it('maps Fr. answers to CHF and infers Fr. from body text', () => {
    const fromField = normalizeDIQueryAnswers({
      totalContractValue: '1 200 000',
      contractCurrency: 'Fr.',
    });
    expect(fromField.metadata.currency).toBe('CHF');
    expect(fromField.metadata.totalValue).toBe(1_200_000);

    const inferred = validateDIQueryAnswers(
      { totalContractValue: '1\'200\'000' },
      'Der Gesamtvertragswert beträgt Fr. 1\'200\'000.',
    );
    expect(inferred.answers.contractCurrency).toBe('CHF');
  });

  it('rejects non-numeric/example total contract values', () => {
    const result = validateDIQueryAnswers(
      {
        totalContractValue: 'CHF 92,500 Late',
        clientName: 'Markus Keller',
      },
      'This Agreement is between ClientCo AG and Supplier GmbH. Total Contract Value: CHF 92,500.'
    );
    expect(result.answers.totalContractValue).toBeUndefined();
    expect(result.rejected).toContain('totalContractValue');
    expect(result.flags.some((f) => f.field === 'totalContractValue')).toBe(true);
    // Party without legal suffix is replaced by nearest legal entity.
    expect(result.answers.clientName).toBe('ClientCo AG');
  });

  it('normalizes dates and infers missing currency', () => {
    const result = validateDIQueryAnswers(
      {
        effectiveDate: 'March 9, 2026',
        totalContractValue: '1,200,000',
      },
      'The total consideration is CHF 1,200,000. Effective Date: March 9, 2026.'
    );
    expect(result.answers.effectiveDate).toBe('2026-03-09');
    expect(result.answers.contractCurrency).toBe('CHF');
  });

  it('parses Swiss numeric and German month dates from DI answers', () => {
    const dotted = validateDIQueryAnswers(
      { effectiveDate: '01.04.2026', expirationDate: '31.03.2029' },
      'Inkrafttreten: 01.04.2026. Gültig bis 31.03.2029.',
    );
    expect(dotted.answers.effectiveDate).toBe('2026-04-01');
    expect(dotted.answers.expirationDate).toBe('2029-03-31');

    const named = validateDIQueryAnswers(
      { effectiveDate: '1. Januar 2026' },
      'Inkrafttreten am 1. Januar 2026.',
    );
    expect(named.answers.effectiveDate).toBe('2026-01-01');
  });
});

describe('parseIsoDate', () => {
  it('treats dotted numerics as DD.MM.YYYY', () => {
    expect(parseIsoDate('03.04.2026')).toBe('2026-04-03');
    expect(parseIsoDate('1. Januar 2026')).toBe('2026-01-01');
    expect(parseIsoDate('March 9, 2026')).toBe('2026-03-09');
  });
});

describe('assessCriticalContractEvidence', () => {
  it('combines deterministic value, term, party, and signature evidence', () => {
    const result = assessCriticalContractEvidence(`Strategic Supply Agreement
Client: Alpine Retail AG
Supplier: Nordic Components GmbH
Effective Date: 1 April 2026
This Agreement shall remain in force for an initial term of three (3) years, until 31 March 2029.
The transaction fee shall amount to CHF 1.2 million. Expenses are capped at CHF 25,000.
Either party may terminate the Agreement with 90 days written notice.
Signed by: Markus Keller`);

    expect(result.metadata).toMatchObject({
      totalValue: 1_200_000,
      currency: 'CHF',
      endDate: '2029-03-31',
      noticePeriodDays: 90,
      clientName: 'Alpine Retail AG',
      supplierName: 'Nordic Components GmbH',
      signatureStatus: 'signed',
    });
    expect(result.financial.bestCandidate?.kind).toBe('aggregate');
    expect(result.parties.source).toBe('rawText:role-labels');
  });
});