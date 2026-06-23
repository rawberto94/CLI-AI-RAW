import { describe, expect, it } from 'vitest';

import { assessCriticalContractEvidence, assessContractTermEvidence, CONTRACT_DI_QUERY_FIELDS, CONTRACT_DI_QUERY_IDENTIFIERS, extractFinancialEvidence, normalizeDIQueryAnswers, validateDIQueryAnswers } from '../src/contract-extraction';

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
});

describe('normalizeDIQueryAnswers', () => {
  it('normalizes DI query answers into metadata and evidence', () => {
    const result = normalizeDIQueryAnswers({
      'What is the contract effective date?': 'March 9, 2026',
      'What is the contract expiration date or end date?': 'March 9, 2028',
      'What is the total contract value or aggregate fee?': 'CHF 1.2 million',
      'What is the termination or renewal notice period?': '60 days before expiration',
      'Who are the contracting parties?': 'ClientCo AG and AdvisoryFirm Global Advisory Country X AG',
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
      'What is the contract effective date?': 'March 9, 2026',
      'What is the initial contract term or duration?': '2 years from the Effective Date',
    });

    expect(result.metadata).toMatchObject({
      startDate: '2026-03-09',
      endDate: '2028-03-09',
      initialTerm: '2 years from the Effective Date',
    });
  });

  it('normalizes expanded critical-field lookup answers', () => {
    const result = normalizeDIQueryAnswers({
      'What is the contract title or agreement name?': 'Strategic Supply Agreement',
      'What type of contract is this?': 'Supplier Agreement',
      'Who is the client, buyer, or customer?': 'ClientCo AG',
      'Who is the supplier, vendor, or service provider?': 'Nordic Components GmbH',
      'Is the contract signed, partially signed, unsigned, or unknown?': 'Not signed; signature fields are blank.',
      'What is the signature or execution date?': 'not specified',
      'Does the contract automatically renew?': 'No, it does not automatically renew.',
      'What is the termination clause or termination right?': 'Either party may terminate with 90 days written notice.',
      'What is the liability cap or limitation of liability amount?': 'Liability is capped at CHF 500,000.',
      'What are the key deliverables, service levels, or obligations?': 'Supplier will deliver components according to the monthly forecast.',
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
    expect(CONTRACT_DI_QUERY_IDENTIFIERS.every((id) => /^[\p{L}\p{M}\p{N}_]{1,64}$/u.test(id))).toBe(true);
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