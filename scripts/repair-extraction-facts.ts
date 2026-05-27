import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { assessContractTermEvidence, extractFinancialEvidence } = require('../packages/utils/dist/index.js') as typeof import('../packages/utils/src/index');

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const allContracts = args.has('--all');
const filenameFilters = process.argv
  .slice(2)
  .filter(arg => arg.startsWith('--filename='))
  .map(arg => arg.slice('--filename='.length).trim())
  .filter(Boolean);

const defaultFilters = ['TEST_Mutual_NDA', 'TEST_Advisory_Agreement'];
const activeFilters = allContracts ? [] : (filenameFilters.length > 0 ? filenameFilters : defaultFilters);

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateChanged(current: Date | null, nextIso: string): boolean {
  return toIsoDate(current) !== nextIso;
}

function cloneJsonObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function isDifferentJson(left: unknown, right: unknown): boolean {
  return stableStringify(left) !== stableStringify(right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function upsertKeyDate(data: Record<string, any>, label: string, date: string, source: string): void {
  const keyDates = Array.isArray(data.keyDates) ? [...data.keyDates] : [];
  const existingIndex = keyDates.findIndex((item: any) =>
    typeof item === 'object' && item && String(item.label || item.name || '').toLowerCase() === label.toLowerCase()
  );
  const nextItem = { label, date, source };
  if (existingIndex >= 0) keyDates[existingIndex] = { ...keyDates[existingIndex], ...nextItem };
  else keyDates.push(nextItem);
  data.keyDates = keyDates;
}

function patchArtifactData(
  artifactType: string,
  currentData: unknown,
  facts: {
    endDate: string | null;
    totalValue: number | null;
    currency: string | null;
    initialTerm: string | null;
    renewalTerm: string | null;
    noticePeriodDays: number | null;
    autoRenewal: boolean;
    financialIssues: string[];
    financialSource: string | null;
    termSource: string | null;
  }
): Record<string, any> | null {
  const data = cloneJsonObject(currentData);
  const original = stableStringify(data);
  const repairedBy = 'scripts/repair-extraction-facts.ts';

  if (artifactType === 'FINANCIAL') {
    if (facts.totalValue != null) {
      data.totalValue = facts.totalValue;
      data.currency = facts.currency || data.currency || null;
      data.totalValueEvidence = {
        value: facts.totalValue,
        currency: facts.currency || null,
        source: facts.financialSource,
        repairedBy,
      };
    }
    if (facts.financialIssues.length > 0) {
      const existingIssues = Array.isArray(data.validationIssues) ? data.validationIssues : [];
      data.validationIssues = Array.from(new Set([...existingIssues, ...facts.financialIssues]));
    }
  } else if (artifactType === 'RENEWAL') {
    if (facts.endDate) {
      data.expirationDate = facts.endDate;
      data.currentTermEnd = facts.endDate;
    }
    if (facts.initialTerm) data.initialTerm = facts.initialTerm;
    if (facts.renewalTerm) data.renewalTerm = facts.renewalTerm;
    if (facts.noticePeriodDays != null) data.noticePeriodDays = facts.noticePeriodDays;
    data.autoRenewal = facts.autoRenewal;
    data.evidence = { ...(data.evidence || {}), termSource: facts.termSource, repairedBy };
  } else if (artifactType === 'TIMELINE') {
    if (facts.endDate) {
      data.endDate = facts.endDate;
      data.expirationDate = facts.endDate;
      upsertKeyDate(data, 'Expiration Date', facts.endDate, repairedBy);
    }
    if (facts.initialTerm) data.duration = facts.initialTerm;
  } else if (artifactType === 'OVERVIEW') {
    if (facts.endDate) {
      data.endDate = facts.endDate;
      data.expirationDate = facts.endDate;
    }
    if (facts.totalValue != null) {
      data.totalValue = facts.totalValue;
      data.currency = facts.currency || data.currency || null;
    }
  }

  return stableStringify(data) === original ? null : data;
}

async function main() {
  const contracts = await prisma.contract.findMany({
    where: activeFilters.length > 0
      ? { OR: activeFilters.map(filter => ({ fileName: { contains: filter } })) }
      : undefined,
    select: {
      id: true,
      fileName: true,
      rawText: true,
      startDate: true,
      effectiveDate: true,
      endDate: true,
      expirationDate: true,
      totalValue: true,
      currency: true,
      renewalTerms: true,
      noticePeriodDays: true,
      autoRenewalEnabled: true,
      artifacts: {
        where: { type: { in: ['FINANCIAL', 'RENEWAL', 'TIMELINE', 'OVERVIEW'] } },
        select: { id: true, type: true, data: true },
      },
    },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const contract of contracts) {
    const rawText = contract.rawText || '';
    const effectiveDate = toIsoDate(contract.effectiveDate) || toIsoDate(contract.startDate);
    const term = assessContractTermEvidence(rawText, { effectiveDate });
    const financial = extractFinancialEvidence(rawText);
    const data: Record<string, unknown> = {};
    const reasons: string[] = [];

    if (term.derivedEndDate && (!contract.endDate || dateChanged(contract.endDate, term.derivedEndDate))) {
      data.endDate = toDate(term.derivedEndDate);
      reasons.push(`endDate -> ${term.derivedEndDate}`);
    }

    if (term.derivedEndDate && (!contract.expirationDate || dateChanged(contract.expirationDate, term.derivedEndDate))) {
      data.expirationDate = toDate(term.derivedEndDate);
      reasons.push(`expirationDate -> ${term.derivedEndDate}`);
    }

    if (!contract.renewalTerms && (term.initialTerm || term.renewalTerm || term.sourceQuote)) {
      data.renewalTerms = {
        initialTerm: term.initialTerm?.text ?? null,
        renewalTerm: term.renewalTerm?.text ?? null,
        autoRenewal: term.autoRenewal,
        source: term.sourceQuote,
        repairedBy: 'scripts/repair-extraction-facts.ts',
      };
      reasons.push('renewalTerms populated from rawText');
    }

    if (contract.noticePeriodDays == null && term.noticePeriodDays != null) {
      data.noticePeriodDays = term.noticePeriodDays;
      reasons.push(`noticePeriodDays -> ${term.noticePeriodDays}`);
    }

    if (term.autoRenewal && contract.autoRenewalEnabled !== true) {
      data.autoRenewalEnabled = true;
      reasons.push('autoRenewalEnabled -> true');
    }

    const currentTotalValue = decimalToNumber(contract.totalValue);
    if (financial.totalValue != null && (currentTotalValue == null || currentTotalValue < financial.totalValue * 0.5)) {
      data.totalValue = financial.totalValue;
      reasons.push(`totalValue -> ${financial.totalValue}`);
    }

    if (financial.currency && (!contract.currency || contract.currency !== financial.currency)) {
      data.currency = financial.currency;
      reasons.push(`currency -> ${financial.currency}`);
    }

    if (Object.keys(data).length > 0 && apply) {
      await prisma.contract.update({ where: { id: contract.id }, data });
    }

    const artifactPatches = contract.artifacts
      .map(artifact => {
        const nextData = patchArtifactData(artifact.type, artifact.data, {
          endDate: term.derivedEndDate,
          totalValue: financial.totalValue,
          currency: financial.currency,
          initialTerm: term.initialTerm?.text ?? null,
          renewalTerm: term.renewalTerm?.text ?? null,
          noticePeriodDays: term.noticePeriodDays,
          autoRenewal: term.autoRenewal,
          financialIssues: financial.validationIssues,
          financialSource: financial.bestCandidate?.source ?? null,
          termSource: term.sourceQuote,
        });
        return nextData && isDifferentJson(artifact.data, nextData)
          ? { id: artifact.id, type: artifact.type, data: nextData }
          : null;
      })
      .filter((patch): patch is { id: string; type: string; data: Record<string, any> } => Boolean(patch));

    if (artifactPatches.length > 0) {
      reasons.push(`artifacts patched: ${artifactPatches.map(patch => patch.type).join(', ')}`);
      if (apply) {
        for (const patch of artifactPatches) {
          await prisma.artifact.update({
            where: { id: patch.id },
            data: {
              data: patch.data,
              validationStatus: 'needs_review',
              regeneratedAt: new Date(),
              regeneratedBy: 'repair-extraction-facts',
              regenerationReason: 'Synchronized artifact facts with deterministic contract extraction repair',
            },
          });
        }
      }
    }

    results.push({
      id: contract.id,
      fileName: contract.fileName,
      mode: apply ? 'apply' : 'dry-run',
      changed: Object.keys(data).length > 0 || artifactPatches.length > 0,
      reasons,
      artifactPatches: artifactPatches.map(patch => patch.type),
      detected: {
        effectiveDate,
        derivedEndDate: term.derivedEndDate,
        initialTerm: term.initialTerm?.text ?? null,
        renewalTerm: term.renewalTerm?.text ?? null,
        totalValue: financial.totalValue,
        currency: financial.currency,
        bestAmount: financial.bestCandidate?.amountText ?? null,
      },
    });
  }

  console.log(JSON.stringify({ apply, count: results.length, results }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });