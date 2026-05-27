import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  assessCriticalContractEvidence,
} = require('../packages/utils/dist/index.js') as typeof import('../packages/utils/src/index');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flags = new Set(args);
const apply = flags.has('--apply');
const allContracts = flags.has('--all');
const tenantId = args.find(arg => arg.startsWith('--tenant='))?.slice('--tenant='.length);
const contractId = args.find(arg => arg.startsWith('--contract='))?.slice('--contract='.length);
const filenameFilters = args
  .filter(arg => arg.startsWith('--filename='))
  .map(arg => arg.slice('--filename='.length).trim())
  .filter(Boolean);

const defaultFilenameFilters = ['TEST_Advisory_Agreement', 'TEST_Mutual_NDA', 'realistic_contract'];

type AuditStatus = 'ok' | 'needs_repair' | 'needs_review' | 'no_raw_text';

interface CriticalAuditResult {
  contractId: string;
  tenantId: string;
  fileName: string | null;
  title: string | null;
  status: AuditStatus;
  repaired: boolean;
  repairs: Record<string, unknown>;
  review: string[];
  evidence: {
    totalValue: number | null;
    currency: string | null;
    endDate: string | null;
    initialTerm: string | null;
    renewalTerm: string | null;
    noticePeriodDays: number | null;
    autoRenewal: boolean;
    signatureStatus: string | null;
    clientName: string | null;
    supplierName: string | null;
  };
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function cloneJsonObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function sameName(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return left.replace(/\s+/g, ' ').trim().toLowerCase() === right.replace(/\s+/g, ' ').trim().toLowerCase();
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function patchFinancialArtifact(data: Record<string, any>, value: number, currency: string | null, source: string | null): Record<string, any> {
  const next = { ...data };
  next.totalValue = value;
  if (currency) next.currency = currency;
  next.totalValueEvidence = {
    value,
    currency: currency || null,
    source,
    repairedBy: 'scripts/audit-critical-fields.ts',
  };
  const issues = Array.isArray(next.validationIssues) ? next.validationIssues : [];
  next.validationIssues = Array.from(new Set([...issues, `Adjusted totalValue to ${value} based on aggregate-value evidence.`]));
  return next;
}

function patchRenewalArtifact(data: Record<string, any>, term: ReturnType<typeof assessCriticalContractEvidence>['term']): Record<string, any> {
  const next = { ...data };
  if (term.derivedEndDate) {
    next.expirationDate = term.derivedEndDate;
    next.currentTermEnd = term.derivedEndDate;
  }
  if (term.initialTerm?.text) next.initialTerm = term.initialTerm.text;
  if (term.renewalTerm?.text) next.renewalTerm = term.renewalTerm.text;
  if (term.noticePeriodDays != null) next.noticePeriodDays = term.noticePeriodDays;
  next.autoRenewal = term.autoRenewal;
  next.evidence = { ...(getObject(next.evidence) || {}), termSource: term.sourceQuote, repairedBy: 'scripts/audit-critical-fields.ts' };
  return next;
}

async function main() {
  const activeFilenameFilters = allContracts || contractId
    ? []
    : (filenameFilters.length > 0 ? filenameFilters : defaultFilenameFilters);

  const contracts = await prisma.contract.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(contractId ? { id: contractId } : {}),
      ...(!contractId && activeFilenameFilters.length > 0
        ? { OR: activeFilenameFilters.map(filter => ({ fileName: { contains: filter } })) }
        : {}),
      isDeleted: false,
    },
    select: {
      id: true,
      tenantId: true,
      fileName: true,
      originalName: true,
      contractTitle: true,
      rawText: true,
      totalValue: true,
      currency: true,
      effectiveDate: true,
      startDate: true,
      endDate: true,
      expirationDate: true,
      renewalTerms: true,
      noticePeriodDays: true,
      autoRenewalEnabled: true,
      clientName: true,
      supplierName: true,
      signatureStatus: true,
      signatureRequiredFlag: true,
      artifacts: {
        where: { type: { in: ['FINANCIAL', 'OVERVIEW', 'RENEWAL', 'TIMELINE', 'PARTIES'] } },
        select: { id: true, type: true, data: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const results: CriticalAuditResult[] = [];

  for (const contract of contracts) {
    const repairs: Record<string, unknown> = {};
    const review: string[] = [];
    let repaired = false;

    if (!contract.rawText || contract.rawText.trim().length < 20) {
      results.push({
        contractId: contract.id,
        tenantId: contract.tenantId,
        fileName: contract.fileName || contract.originalName,
        title: contract.contractTitle,
        status: 'no_raw_text',
        repaired: false,
        repairs,
        review: ['Contract has no raw text available for evidence scoring'],
        evidence: {
          totalValue: null,
          currency: null,
          endDate: null,
          initialTerm: null,
          renewalTerm: null,
          noticePeriodDays: null,
          autoRenewal: false,
          signatureStatus: null,
          clientName: null,
          supplierName: null,
        },
      });
      continue;
    }

    const byType = new Map(contract.artifacts.map(artifact => [artifact.type, artifact]));
    const financialArtifact = byType.get('FINANCIAL');
    const overviewArtifact = byType.get('OVERVIEW');
    const renewalArtifact = byType.get('RENEWAL');
    const timelineArtifact = byType.get('TIMELINE');
    const partiesArtifact = byType.get('PARTIES');
    const overviewData = cloneJsonObject(overviewArtifact?.data);
    const financialData = cloneJsonObject(financialArtifact?.data);
    const renewalData = cloneJsonObject(renewalArtifact?.data);
    const timelineData = cloneJsonObject(timelineArtifact?.data);
    const partiesData = cloneJsonObject(partiesArtifact?.data);

    const effectiveDate = toIsoDate(contract.effectiveDate) || toIsoDate(contract.startDate);
    const criticalEvidence = assessCriticalContractEvidence(contract.rawText, { effectiveDate, overviewData, partiesData });
    const financial = criticalEvidence.financial;
    const term = criticalEvidence.term;
    const partyEvidence = criticalEvidence.parties;
    const signatureStatus = criticalEvidence.signature.status;
    const currentTotalValue = asNumber(contract.totalValue);
    const financialArtifactTotalValue = asNumber(financialData.totalValue);
    const detectedTotalValue = criticalEvidence.metadata.totalValue ?? financial.totalValue;
    const detectedCurrency = criticalEvidence.metadata.currency || financial.currency || contract.currency;
    const currentEndDate = toIsoDate(contract.expirationDate) || toIsoDate(contract.endDate);

    if (detectedTotalValue != null && (currentTotalValue == null || currentTotalValue < detectedTotalValue * 0.5)) {
      repairs.totalValue = detectedTotalValue;
      if (detectedCurrency) repairs.currency = detectedCurrency;
    }
    if (detectedTotalValue != null && financialArtifactTotalValue != null && financialArtifactTotalValue < detectedTotalValue * 0.5) {
      repairs.financialArtifactTotalValue = detectedTotalValue;
    }
    if (term.derivedEndDate && currentEndDate !== term.derivedEndDate) {
      repairs.endDate = term.derivedEndDate;
      repairs.expirationDate = term.derivedEndDate;
    }
    if ((term.initialTerm || term.renewalTerm || term.sourceQuote) && !contract.renewalTerms) {
      repairs.renewalTerms = {
        initialTerm: term.initialTerm?.text ?? null,
        renewalTerm: term.renewalTerm?.text ?? null,
        autoRenewal: term.autoRenewal,
        source: term.sourceQuote,
      };
    }
    if (term.noticePeriodDays != null && contract.noticePeriodDays !== term.noticePeriodDays) {
      repairs.noticePeriodDays = term.noticePeriodDays;
    }
    if (term.autoRenewal && contract.autoRenewalEnabled !== true) {
      repairs.autoRenewalEnabled = true;
    } else if (!term.autoRenewal && contract.autoRenewalEnabled === true && term.sourceQuote) {
      review.push('Stored autoRenewalEnabled=true, but deterministic term evidence did not find explicit auto-renewal language');
    }
    if (signatureStatus && contract.signatureStatus !== signatureStatus) {
      repairs.signatureStatus = signatureStatus;
      repairs.signatureRequiredFlag = signatureStatus !== 'signed';
    }
    if (!contract.clientName && partyEvidence.clientName) repairs.clientName = partyEvidence.clientName;
    if (!contract.supplierName && partyEvidence.supplierName) repairs.supplierName = partyEvidence.supplierName;
    if (contract.clientName && partyEvidence.clientName && !sameName(contract.clientName, partyEvidence.clientName)) {
      review.push(`Client name differs from ${partyEvidence.source}: stored="${contract.clientName}" evidence="${partyEvidence.clientName}"`);
    }
    if (contract.supplierName && partyEvidence.supplierName && !sameName(contract.supplierName, partyEvidence.supplierName)) {
      review.push(`Supplier name differs from ${partyEvidence.source}: stored="${contract.supplierName}" evidence="${partyEvidence.supplierName}"`);
    }

    const needsRepair = Object.keys(repairs).length > 0;
    if (apply && needsRepair) {
      const contractUpdate: Record<string, unknown> = {};
      if (typeof repairs.totalValue === 'number') contractUpdate.totalValue = repairs.totalValue;
      if (typeof repairs.currency === 'string') contractUpdate.currency = repairs.currency;
      if (typeof repairs.endDate === 'string') contractUpdate.endDate = toDate(repairs.endDate);
      if (typeof repairs.expirationDate === 'string') contractUpdate.expirationDate = toDate(repairs.expirationDate);
      if (repairs.renewalTerms) contractUpdate.renewalTerms = repairs.renewalTerms;
      if (typeof repairs.noticePeriodDays === 'number') contractUpdate.noticePeriodDays = repairs.noticePeriodDays;
      if (typeof repairs.autoRenewalEnabled === 'boolean') contractUpdate.autoRenewalEnabled = repairs.autoRenewalEnabled;
      if (typeof repairs.signatureStatus === 'string') contractUpdate.signatureStatus = repairs.signatureStatus;
      if (typeof repairs.signatureRequiredFlag === 'boolean') contractUpdate.signatureRequiredFlag = repairs.signatureRequiredFlag;
      if (typeof repairs.clientName === 'string') contractUpdate.clientName = repairs.clientName;
      if (typeof repairs.supplierName === 'string') contractUpdate.supplierName = repairs.supplierName;

      if (Object.keys(contractUpdate).length > 0) {
        await prisma.contract.update({ where: { id: contract.id }, data: contractUpdate });
        repaired = true;
      }

      if (financialArtifact && detectedTotalValue != null && (repairs.totalValue || repairs.financialArtifactTotalValue)) {
        await prisma.artifact.update({
          where: { id: financialArtifact.id },
          data: {
            data: patchFinancialArtifact(financialData, detectedTotalValue, detectedCurrency || null, financial.bestCandidate?.source || null),
            validationStatus: 'needs_review',
            regeneratedAt: new Date(),
            regeneratedBy: 'audit-critical-fields',
            regenerationReason: 'Synchronized critical financial field with aggregate-value evidence',
          },
        });
        repaired = true;
      }

      if (overviewArtifact && (repairs.totalValue || repairs.endDate || repairs.clientName || repairs.supplierName)) {
        if (detectedTotalValue != null) overviewData.totalValue = detectedTotalValue;
        if (detectedCurrency) overviewData.currency = detectedCurrency;
        if (term.derivedEndDate) {
          overviewData.endDate = term.derivedEndDate;
          overviewData.expirationDate = term.derivedEndDate;
        }
        if (partyEvidence.clientName) overviewData.clientName = partyEvidence.clientName;
        if (partyEvidence.supplierName) overviewData.supplierName = partyEvidence.supplierName;
        await prisma.artifact.update({
          where: { id: overviewArtifact.id },
          data: {
            data: overviewData,
            regeneratedAt: new Date(),
            regeneratedBy: 'audit-critical-fields',
            regenerationReason: 'Synchronized overview critical fields with evidence',
          },
        });
        repaired = true;
      }

      if (renewalArtifact && (repairs.renewalTerms || repairs.noticePeriodDays || repairs.endDate || repairs.autoRenewalEnabled)) {
        await prisma.artifact.update({
          where: { id: renewalArtifact.id },
          data: {
            data: patchRenewalArtifact(renewalData, term),
            validationStatus: 'needs_review',
            regeneratedAt: new Date(),
            regeneratedBy: 'audit-critical-fields',
            regenerationReason: 'Synchronized renewal critical fields with deterministic term evidence',
          },
        });
        repaired = true;
      }

      if (timelineArtifact && repairs.endDate && term.derivedEndDate) {
        timelineData.endDate = term.derivedEndDate;
        timelineData.expirationDate = term.derivedEndDate;
        if (term.initialTerm?.text) timelineData.duration = term.initialTerm.text;
        await prisma.artifact.update({
          where: { id: timelineArtifact.id },
          data: {
            data: timelineData,
            regeneratedAt: new Date(),
            regeneratedBy: 'audit-critical-fields',
            regenerationReason: 'Synchronized timeline date with deterministic term evidence',
          },
        });
        repaired = true;
      }
    }

    results.push({
      contractId: contract.id,
      tenantId: contract.tenantId,
      fileName: contract.fileName || contract.originalName,
      title: contract.contractTitle,
      status: needsRepair ? 'needs_repair' : review.length > 0 ? 'needs_review' : 'ok',
      repaired,
      repairs,
      review,
      evidence: {
        totalValue: detectedTotalValue,
        currency: detectedCurrency || null,
        endDate: term.derivedEndDate,
        initialTerm: term.initialTerm?.text ?? null,
        renewalTerm: term.renewalTerm?.text ?? null,
        noticePeriodDays: term.noticePeriodDays,
        autoRenewal: term.autoRenewal,
        signatureStatus,
        clientName: partyEvidence.clientName,
        supplierName: partyEvidence.supplierName,
      },
    });
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    scanned: results.length,
    ok: results.filter(result => result.status === 'ok').length,
    needsRepair: results.filter(result => result.status === 'needs_repair').length,
    needsReview: results.filter(result => result.status === 'needs_review').length,
    noRawText: results.filter(result => result.status === 'no_raw_text').length,
    repaired: results.filter(result => result.repaired).length,
  };

  console.log(JSON.stringify({ summary, results }, null, 2));

  if (!apply && summary.needsRepair > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });