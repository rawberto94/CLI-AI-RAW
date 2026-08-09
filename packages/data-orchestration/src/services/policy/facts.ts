/**
 * Contract facts projection for FIELD policy rules.
 * Pure unwrapping helpers are exportable without Prisma; buildContractFacts needs DB.
 */

import { createHash } from 'crypto';

export interface PartyFact {
  name?: string;
  role?: string;
  side?: string;
}

export interface ContractFacts {
  overview: {
    contractType?: string | null;
    contractSubtype?: string | null;
    governingLaw?: string | null;
    jurisdiction?: string | null;
    effectiveDate?: string | null;
    expirationDate?: string | null;
    executionDate?: string | null;
    parties: PartyFact[];
    title?: string | null;
    status?: string | null;
  };
  financial: {
    totalValue?: number | null;
    currency?: string | null;
    paymentTermsDays?: number | null;
    paymentTerms?: string | null;
    paymentType?: string | null;
    liabilityCapAmount?: number | null;
    liabilityCapMonths?: number | null;
    lineItemsTotal?: number | null;
    annualValue?: number | null;
  };
  renewal: {
    autoRenewal?: boolean | null;
    noticePeriodDays?: number | null;
    termMonths?: number | null;
    renewalTermMonths?: number | null;
    expirationDate?: string | null;
  };
  clauses: {
    present: Record<string, boolean>;
    byCategory: Record<string, Array<{ name?: string; text?: string }>>;
  };
  compliance: {
    regulations: string[];
    complianceScore?: number | null;
    dataProcessing?: boolean | null;
  };
  risk: {
    overallRisk?: string | null;
    riskScore?: number | null;
    redFlags: string[];
  };
  document: {
    rawTextLength: number;
    ocrConfidence?: number | null;
    pageCount?: number | null;
    language?: string | null;
  };
  /** Provenance for every resolved path */
  _resolved: Record<string, { value: unknown; source: string; path: string }>;
}

/**
 * Unwrap SourcedValue wrappers: { value, source, extractedFromText }
 * Lifted from ocr-artifact-worker for single source of truth.
 */
export function unwrapVal(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(unwrapVal);
  const obj = v as Record<string, unknown>;
  if ('value' in obj && (Object.keys(obj).length <= 4 || 'source' in obj || 'extractedFromText' in obj)) {
    return unwrapVal(obj.value);
  }
  // shallow unwrap nested sourced fields
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) {
    out[k] = unwrapVal(val);
  }
  return out;
}

function parsePaymentTermsDays(terms: unknown): number | null {
  if (typeof terms === 'number' && Number.isFinite(terms)) return terms;
  if (typeof terms !== 'string') return null;
  const m = terms.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,$€£\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function setResolved(
  resolved: ContractFacts['_resolved'],
  path: string,
  value: unknown,
  source: string,
) {
  if (value === null || value === undefined || value === '') return;
  resolved[path] = { value, source, path };
}

/**
 * Stable stringify for hashing (sorted keys, no _resolved).
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const rec = obj as Record<string, unknown>;
  const keys = Object.keys(rec).filter((k) => k !== '_resolved').sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(',')}}`;
}

export function factsHash(facts: ContractFacts): string {
  const { _resolved: _, ...rest } = facts;
  return createHash('sha256').update(stableStringify(rest)).digest('hex');
}

export function emptyFacts(rawTextLength = 0): ContractFacts {
  return {
    overview: { parties: [] },
    financial: {},
    renewal: {},
    clauses: { present: {}, byCategory: {} },
    compliance: { regulations: [] },
    risk: { redFlags: [] },
    document: { rawTextLength },
    _resolved: {},
  };
}

/**
 * Build typed facts projection from contract + artifacts + metadata.
 */
export async function buildContractFacts(args: {
  prisma: any;
  tenantId: string;
  contractId: string;
  rawText?: string | null;
}): Promise<ContractFacts> {
  const { prisma, tenantId, contractId } = args;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: {
      contractMetadata: true,
      artifacts: {
        where: {
          type: {
            in: [
              'OVERVIEW',
              'FINANCIAL',
              'CLAUSES',
              'RENEWAL',
              'COMPLIANCE',
              'RISK',
              'PARTIES',
              'LIABILITY_CLAUSE',
              'TERMINATION_CLAUSE',
            ],
          },
        },
        select: { type: true, data: true },
      },
    },
  });

  if (!contract) {
    return emptyFacts(args.rawText?.length ?? 0);
  }

  const rawTextLength = (args.rawText ?? contract.rawText ?? '').length;
  const facts = emptyFacts(rawTextLength);
  const resolved = facts._resolved;

  // Contract columns first
  facts.overview.contractType = contract.contractType ?? null;
  facts.overview.contractSubtype = contract.contractSubtype ?? null;
  facts.overview.jurisdiction = contract.jurisdiction ?? null;
  facts.overview.effectiveDate = toIsoDate(contract.effectiveDate ?? contract.startDate);
  facts.overview.expirationDate = toIsoDate(contract.expirationDate ?? contract.endDate);
  facts.overview.executionDate = toIsoDate(contract.signatureDate);
  facts.overview.title = contract.contractTitle ?? contract.originalName ?? null;
  facts.overview.status = contract.status ?? null;
  const parties: PartyFact[] = [];
  if (contract.clientName) parties.push({ name: contract.clientName, role: 'client' });
  if (contract.supplierName) parties.push({ name: contract.supplierName, role: 'supplier' });
  facts.overview.parties = parties;

  setResolved(resolved, 'overview.contractType', facts.overview.contractType, 'Contract');
  setResolved(resolved, 'overview.jurisdiction', facts.overview.jurisdiction, 'Contract');
  setResolved(resolved, 'overview.effectiveDate', facts.overview.effectiveDate, 'Contract');
  setResolved(resolved, 'overview.expirationDate', facts.overview.expirationDate, 'Contract');

  facts.financial.totalValue = toNumber(contract.totalValue);
  facts.financial.currency = contract.currency ?? null;
  facts.financial.paymentTerms = contract.paymentTerms ?? null;
  facts.financial.paymentTermsDays = parsePaymentTermsDays(contract.paymentTerms);
  facts.financial.annualValue = toNumber(contract.annualValue);
  setResolved(resolved, 'financial.totalValue', facts.financial.totalValue, 'Contract');
  setResolved(resolved, 'financial.currency', facts.financial.currency, 'Contract');
  setResolved(resolved, 'financial.paymentTermsDays', facts.financial.paymentTermsDays, 'Contract');

  facts.renewal.autoRenewal = contract.autoRenewalEnabled ?? null;
  facts.renewal.noticePeriodDays = contract.noticePeriodDays ?? null;
  facts.renewal.expirationDate = facts.overview.expirationDate;
  setResolved(resolved, 'renewal.autoRenewal', facts.renewal.autoRenewal, 'Contract');
  setResolved(resolved, 'renewal.noticePeriodDays', facts.renewal.noticePeriodDays, 'Contract');

  // Metadata
  const meta = contract.contractMetadata as any;
  if (meta) {
    if (meta.riskScore != null) {
      facts.risk.riskScore = meta.riskScore;
      setResolved(resolved, 'risk.riskScore', meta.riskScore, 'ContractMetadata');
    }
    if (meta.complianceStatus) {
      setResolved(resolved, 'compliance.status', meta.complianceStatus, 'ContractMetadata');
    }
  }

  // Artifacts (override / enrich)
  const byType = new Map<string, any>();
  for (const a of contract.artifacts || []) {
    byType.set(a.type, unwrapVal(a.data));
  }

  const overview = byType.get('OVERVIEW');
  if (overview && typeof overview === 'object') {
    if (overview.governingLaw) {
      facts.overview.governingLaw = String(overview.governingLaw);
      setResolved(resolved, 'overview.governingLaw', facts.overview.governingLaw, 'OVERVIEW');
    }
    if (overview.jurisdiction) {
      facts.overview.jurisdiction = String(overview.jurisdiction);
      setResolved(resolved, 'overview.jurisdiction', facts.overview.jurisdiction, 'OVERVIEW');
    }
    if (overview.effectiveDate) {
      facts.overview.effectiveDate = toIsoDate(overview.effectiveDate) ?? facts.overview.effectiveDate;
      setResolved(resolved, 'overview.effectiveDate', facts.overview.effectiveDate, 'OVERVIEW');
    }
    if (overview.expirationDate || overview.terminationDate) {
      facts.overview.expirationDate =
        toIsoDate(overview.expirationDate || overview.terminationDate) ?? facts.overview.expirationDate;
      setResolved(resolved, 'overview.expirationDate', facts.overview.expirationDate, 'OVERVIEW');
    }
    if (Array.isArray(overview.parties) && overview.parties.length) {
      facts.overview.parties = overview.parties.map((p: any) =>
        typeof p === 'string' ? { name: p } : { name: p?.name, role: p?.role, side: p?.side },
      );
      setResolved(resolved, 'overview.parties', facts.overview.parties, 'OVERVIEW');
    }
    if (overview.contractType) {
      facts.overview.contractType = String(overview.contractType);
      setResolved(resolved, 'overview.contractType', facts.overview.contractType, 'OVERVIEW');
    }
  }

  const financial = byType.get('FINANCIAL');
  if (financial && typeof financial === 'object') {
    const summary = financial.financialSummary || financial;
    const tv = toNumber(summary.totalValue ?? financial.totalValue);
    if (tv != null) {
      facts.financial.totalValue = tv;
      setResolved(resolved, 'financial.totalValue', tv, 'FINANCIAL');
    }
    const ptd = parsePaymentTermsDays(summary.paymentTerms ?? financial.paymentTerms);
    if (ptd != null) {
      facts.financial.paymentTermsDays = ptd;
      setResolved(resolved, 'financial.paymentTermsDays', ptd, 'FINANCIAL');
    }
    const cap = toNumber(financial.liabilityCapAmount ?? summary.liabilityCapAmount);
    if (cap != null) {
      facts.financial.liabilityCapAmount = cap;
      setResolved(resolved, 'financial.liabilityCapAmount', cap, 'FINANCIAL');
    }
    const capM = toNumber(financial.liabilityCapMonths ?? summary.liabilityCapMonths);
    if (capM != null) {
      facts.financial.liabilityCapMonths = capM;
      setResolved(resolved, 'financial.liabilityCapMonths', capM, 'FINANCIAL');
    }
    const lineItems = financial.lineItems || financial.financialTerms;
    if (Array.isArray(lineItems)) {
      let sum = 0;
      let any = false;
      for (const li of lineItems) {
        const amt = toNumber(li?.amount ?? li?.value);
        if (amt != null) {
          sum += amt;
          any = true;
        }
      }
      if (any) {
        facts.financial.lineItemsTotal = sum;
        setResolved(resolved, 'financial.lineItemsTotal', sum, 'FINANCIAL');
      }
    }
    if (financial.currency || summary.currency) {
      facts.financial.currency = String(financial.currency || summary.currency);
      setResolved(resolved, 'financial.currency', facts.financial.currency, 'FINANCIAL');
    }
  }

  const renewal = byType.get('RENEWAL');
  if (renewal && typeof renewal === 'object') {
    if (renewal.autoRenewal != null || renewal.autoRenewalEnabled != null) {
      facts.renewal.autoRenewal = Boolean(renewal.autoRenewal ?? renewal.autoRenewalEnabled);
      setResolved(resolved, 'renewal.autoRenewal', facts.renewal.autoRenewal, 'RENEWAL');
    }
    const np = toNumber(renewal.noticePeriodDays ?? renewal.noticeDays);
    if (np != null) {
      facts.renewal.noticePeriodDays = np;
      setResolved(resolved, 'renewal.noticePeriodDays', np, 'RENEWAL');
    }
    const tm = toNumber(renewal.termMonths ?? renewal.initialTermMonths);
    if (tm != null) {
      facts.renewal.termMonths = tm;
      setResolved(resolved, 'renewal.termMonths', tm, 'RENEWAL');
    }
    const rtm = toNumber(renewal.renewalTermMonths);
    if (rtm != null) {
      facts.renewal.renewalTermMonths = rtm;
      setResolved(resolved, 'renewal.renewalTermMonths', rtm, 'RENEWAL');
    }
  }

  const clauses = byType.get('CLAUSES');
  if (clauses && typeof clauses === 'object') {
    const list = Array.isArray(clauses.clauses) ? clauses.clauses : Array.isArray(clauses) ? clauses : [];
    for (const c of list) {
      const cat = String(c?.category || c?.type || c?.name || 'other').toLowerCase().replace(/\s+/g, '_');
      facts.clauses.present[cat] = true;
      if (!facts.clauses.byCategory[cat]) facts.clauses.byCategory[cat] = [];
      facts.clauses.byCategory[cat].push({ name: c?.name, text: c?.text || c?.snippet });
      setResolved(resolved, `clauses.present.${cat}`, true, 'CLAUSES');
    }
  }

  // Presence from specialized clause artifacts
  for (const [type, path] of [
    ['LIABILITY_CLAUSE', 'limitation_of_liability'],
    ['TERMINATION_CLAUSE', 'termination'],
  ] as const) {
    if (byType.has(type)) {
      facts.clauses.present[path] = true;
      setResolved(resolved, `clauses.present.${path}`, true, type);
    }
  }

  const compliance = byType.get('COMPLIANCE');
  if (compliance && typeof compliance === 'object') {
    facts.compliance.complianceScore = toNumber(compliance.complianceScore);
    if (facts.compliance.complianceScore != null) {
      setResolved(resolved, 'compliance.complianceScore', facts.compliance.complianceScore, 'COMPLIANCE');
    }
    const regs = compliance.regulations || compliance.frameworks || [];
    if (Array.isArray(regs)) {
      facts.compliance.regulations = regs.map(String);
      setResolved(resolved, 'compliance.regulations', facts.compliance.regulations, 'COMPLIANCE');
    }
    if (compliance.dataProcessing != null) {
      facts.compliance.dataProcessing = Boolean(compliance.dataProcessing);
      setResolved(resolved, 'compliance.dataProcessing', facts.compliance.dataProcessing, 'COMPLIANCE');
    }
  }

  const risk = byType.get('RISK');
  if (risk && typeof risk === 'object') {
    facts.risk.overallRisk = risk.overallRisk || risk.overallRiskLevel || null;
    facts.risk.riskScore = toNumber(risk.riskScore) ?? facts.risk.riskScore;
    if (facts.risk.overallRisk) setResolved(resolved, 'risk.overallRisk', facts.risk.overallRisk, 'RISK');
    if (facts.risk.riskScore != null) setResolved(resolved, 'risk.riskScore', facts.risk.riskScore, 'RISK');
    const flags = risk.redFlags || [];
    if (Array.isArray(flags)) {
      facts.risk.redFlags = flags.map((f: any) => (typeof f === 'string' ? f : f?.title || f?.description || String(f)));
      setResolved(resolved, 'risk.redFlags', facts.risk.redFlags, 'RISK');
    }
  }

  facts.document.rawTextLength = rawTextLength;
  setResolved(resolved, 'document.rawTextLength', rawTextLength, 'Contract');

  return facts;
}
