import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractFinancialEvidence } = require('../packages/utils/dist/index.js') as typeof import('../packages/utils/src/index');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flags = new Set(args);
const apply = flags.has('--apply');
const allContracts = flags.has('--all');
const thresholdArg = args.find(arg => arg.startsWith('--threshold='));
const threshold = thresholdArg ? Number(thresholdArg.slice('--threshold='.length)) : 0.5;
const tenantId = args.find(arg => arg.startsWith('--tenant='))?.slice('--tenant='.length);
const contractId = args.find(arg => arg.startsWith('--contract='))?.slice('--contract='.length);
const filenameFilters = args
  .filter(arg => arg.startsWith('--filename='))
  .map(arg => arg.slice('--filename='.length).trim())
  .filter(Boolean);

const defaultFilenameFilters = ['TEST_Advisory_Agreement', 'realistic_contract'];

type AuditStatus = 'ok' | 'needs_repair' | 'missing_evidence' | 'no_raw_text' | 'no_detected_tcv';

interface AuditResult {
  contractId: string;
  tenantId: string;
  fileName: string | null;
  title: string | null;
  status: AuditStatus;
  repaired: boolean;
  currentTotalValue: number | null;
  financialArtifactTotalValue: number | null;
  detectedTotalValue: number | null;
  detectedCurrency: string | null;
  bestEvidence: string | null;
  reasons: string[];
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function cloneJsonObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function needsValueRepair(currentValue: number | null, detectedValue: number | null): boolean {
  if (detectedValue == null || detectedValue <= 0) return false;
  return currentValue == null || currentValue < detectedValue * threshold;
}

function appendUniqueIssue(data: Record<string, any>, issue: string): void {
  const existingIssues = Array.isArray(data.validationIssues) ? data.validationIssues : [];
  data.validationIssues = Array.from(new Set([...existingIssues, issue]));
}

async function main() {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
    throw new Error('--threshold must be a number greater than 0 and less than 1');
  }

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
      artifacts: {
        where: { type: { in: ['FINANCIAL', 'OVERVIEW'] } },
        select: { id: true, type: true, data: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const results: AuditResult[] = [];

  for (const contract of contracts) {
    const financialArtifact = contract.artifacts.find(artifact => artifact.type === 'FINANCIAL');
    const overviewArtifact = contract.artifacts.find(artifact => artifact.type === 'OVERVIEW');
    const financialData = cloneJsonObject(financialArtifact?.data);
    const overviewData = cloneJsonObject(overviewArtifact?.data);
    const currentTotalValue = asNumber(contract.totalValue);
    const financialArtifactTotalValue = asNumber(financialData.totalValue);
    const reasons: string[] = [];

    if (!contract.rawText || contract.rawText.trim().length < 20) {
      results.push({
        contractId: contract.id,
        tenantId: contract.tenantId,
        fileName: contract.fileName || contract.originalName,
        title: contract.contractTitle,
        status: 'no_raw_text',
        repaired: false,
        currentTotalValue,
        financialArtifactTotalValue,
        detectedTotalValue: null,
        detectedCurrency: null,
        bestEvidence: null,
        reasons: ['Contract has no raw text available for evidence scoring'],
      });
      continue;
    }

    const evidence = extractFinancialEvidence(contract.rawText);
    const detectedTotalValue = evidence.totalValue;
    const detectedCurrency = evidence.currency || contract.currency;
    const bestEvidence = evidence.bestCandidate?.source || null;
    const repairContractValue = needsValueRepair(currentTotalValue, detectedTotalValue);
    const repairFinancialArtifact = needsValueRepair(financialArtifactTotalValue, detectedTotalValue);
    const repairOverviewArtifact = needsValueRepair(asNumber(overviewData.totalValue), detectedTotalValue);
    let status: AuditStatus = 'ok';

    if (detectedTotalValue == null) {
      status = currentTotalValue != null && currentTotalValue > 0 ? 'missing_evidence' : 'no_detected_tcv';
      if (currentTotalValue != null && currentTotalValue > 0) reasons.push('Stored totalValue exists but no aggregate-value evidence was detected in raw text');
      else reasons.push('No aggregate total contract value detected');
    } else {
      if (repairContractValue) reasons.push(`Contract.totalValue ${currentTotalValue ?? 'null'} is materially below detected aggregate value ${detectedTotalValue}`);
      if (repairFinancialArtifact) reasons.push(`FINANCIAL.totalValue ${financialArtifactTotalValue ?? 'null'} is materially below detected aggregate value ${detectedTotalValue}`);
      if (repairOverviewArtifact) reasons.push('OVERVIEW.totalValue is missing or materially below detected aggregate value');
      if (reasons.length > 0) status = 'needs_repair';
    }

    let repaired = false;
    if (apply && detectedTotalValue != null && status === 'needs_repair') {
      if (repairContractValue) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            totalValue: detectedTotalValue,
            ...(detectedCurrency ? { currency: detectedCurrency } : {}),
            updatedAt: new Date(),
          },
        });
        repaired = true;
      }

      if (financialArtifact && repairFinancialArtifact) {
        financialData.totalValue = detectedTotalValue;
        if (detectedCurrency) financialData.currency = detectedCurrency;
        financialData.totalValueEvidence = {
          value: detectedTotalValue,
          currency: detectedCurrency || null,
          source: bestEvidence,
          repairedBy: 'scripts/audit-tcv-quality.ts',
        };
        appendUniqueIssue(financialData, `Adjusted totalValue to ${detectedTotalValue} based on aggregate-value evidence.`);
        await prisma.artifact.update({
          where: { id: financialArtifact.id },
          data: {
            data: financialData,
            validationStatus: 'needs_review',
            regeneratedAt: new Date(),
            regeneratedBy: 'audit-tcv-quality',
            regenerationReason: 'Corrected TCV using aggregate-value evidence from raw contract text',
          },
        });
        repaired = true;
      }

      if (overviewArtifact && repairOverviewArtifact) {
        overviewData.totalValue = detectedTotalValue;
        if (detectedCurrency) overviewData.currency = detectedCurrency;
        await prisma.artifact.update({
          where: { id: overviewArtifact.id },
          data: {
            data: overviewData,
            regeneratedAt: new Date(),
            regeneratedBy: 'audit-tcv-quality',
            regenerationReason: 'Synchronized overview TCV with aggregate-value evidence',
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
      status,
      repaired,
      currentTotalValue,
      financialArtifactTotalValue,
      detectedTotalValue,
      detectedCurrency: detectedCurrency || null,
      bestEvidence,
      reasons,
    });
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    threshold,
    scanned: results.length,
    ok: results.filter(result => result.status === 'ok').length,
    needsRepair: results.filter(result => result.status === 'needs_repair').length,
    missingEvidence: results.filter(result => result.status === 'missing_evidence').length,
    noDetectedTcv: results.filter(result => result.status === 'no_detected_tcv').length,
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