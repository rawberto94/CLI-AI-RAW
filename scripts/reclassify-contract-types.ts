#!/usr/bin/env npx tsx
/**
 * Reclassify Contract Types
 * 
 * Backfill / reclassify contracts that have contractType = 'UNKNOWN' or null
 * using the keyword-based detector (fast, no API calls) with optional AI fallback.
 * 
 * Usage:
 *   npx tsx scripts/reclassify-contract-types.ts
 *   npx tsx scripts/reclassify-contract-types.ts --tenant demo --limit 50
 *   npx tsx scripts/reclassify-contract-types.ts --force --use-ai
 *   npx tsx scripts/reclassify-contract-types.ts --dry-run
 * 
 * Flags:
 *   --dry-run    Preview changes without writing to DB
 *   --force      Reclassify ALL contracts, not just UNKNOWN/null
 *   --use-ai     Use AI-based detection for low-confidence keyword results
 *   --tenant ID  Process only contracts for this tenant
 *   --limit N    Maximum contracts to process (default: 500)
 */

import { PrismaClient } from '@prisma/client';
import {
  detectContractType,
  detectContractTypeWithAI,
  getContractProfile,
} from '../packages/workers/src/contract-type-profiles';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    useAi: args.includes('--use-ai'),
    tenant: '',
    limit: 500,
  };

  const tenantIdx = args.indexOf('--tenant');
  if (tenantIdx !== -1 && args[tenantIdx + 1]) {
    flags.tenant = args[tenantIdx + 1];
  }

  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    flags.limit = parseInt(args[limitIdx + 1], 10) || 500;
  }

  return flags;
}

async function main() {
  const flags = parseArgs();

  console.log('=== Contract Type Reclassification ===');
  console.log(`  Dry run: ${flags.dryRun}`);
  console.log(`  Force: ${flags.force}`);
  console.log(`  Use AI: ${flags.useAi}`);
  console.log(`  Tenant: ${flags.tenant || 'all'}`);
  console.log(`  Limit: ${flags.limit}`);
  console.log('');

  // Build query
  const where: any = {
    isDeleted: false,
  };

  if (!flags.force) {
    where.OR = [
      { contractType: null },
      { contractType: 'UNKNOWN' },
      { contractType: 'OTHER' },
    ];
  }

  if (flags.tenant) {
    where.tenantId = flags.tenant;
  }

  const contracts = await prisma.contract.findMany({
    where,
    take: flags.limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      contractType: true,
      fileName: true,
      rawText: true,
      storagePath: true,
    },
  });

  console.log(`Found ${contracts.length} contracts to process\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const typeCounts: Record<string, number> = {};

  for (const contract of contracts) {
    try {
      // Get text content for classification
      let text = contract.rawText || '';

      if (!text || text.length < 20) {
        // Try reading from OVERVIEW artifact
        const overview = await prisma.artifact.findFirst({
          where: { contractId: contract.id, type: 'OVERVIEW' },
          select: { data: true },
        });
        if (overview?.data && typeof overview.data === 'object') {
          const data = overview.data as any;
          text = [data.summary, data.rawText, JSON.stringify(data)].filter(Boolean).join('\n');
        }
      }

      if (!text || text.length < 20) {
        console.log(`  [SKIP] ${contract.id} (${contract.fileName}) — no text content`);
        skipped++;
        continue;
      }

      // Keyword-based detection first (fast, no API call)
      const keywordResult = detectContractType(text);
      let detectedType = keywordResult.type;
      let confidence = keywordResult.confidence;
      let method = 'keyword';

      // AI fallback for low-confidence results
      if (flags.useAi && confidence < 0.5) {
        try {
          const aiResult = await detectContractTypeWithAI(text);
          if (aiResult.confidence > confidence) {
            detectedType = aiResult.type;
            confidence = aiResult.confidence;
            method = 'ai';
          }
        } catch {
          // Continue with keyword result
        }
      }

      if (detectedType === 'OTHER' || confidence < 0.3) {
        console.log(`  [SKIP] ${contract.id} (${contract.fileName}) — detected OTHER (conf: ${confidence.toFixed(2)})`);
        skipped++;
        continue;
      }

      const profile = getContractProfile(detectedType);
      typeCounts[detectedType] = (typeCounts[detectedType] || 0) + 1;

      const changeLabel = contract.contractType !== detectedType
        ? `${contract.contractType || 'null'} → ${detectedType}`
        : `(same: ${detectedType})`;

      console.log(`  [${flags.dryRun ? 'DRY' : 'UPD'}] ${contract.id} (${contract.fileName}) — ${changeLabel} [${profile.displayName}] (conf: ${confidence.toFixed(2)}, method: ${method})`);

      if (!flags.dryRun && contract.contractType !== detectedType) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            contractType: detectedType,
            classificationConf: confidence,
            classificationMeta: {
              method: `reclassify-script-${method}`,
              confidence,
              matchedKeywords: keywordResult.matchedKeywords,
              previousType: contract.contractType,
              profileDisplayName: profile.displayName,
              detectedAt: new Date().toISOString(),
            },
            classifiedAt: new Date(),
          },
        });
        updated++;
      } else if (contract.contractType === detectedType) {
        skipped++;
      }
    } catch (error) {
      console.error(`  [FAIL] ${contract.id} — ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${contracts.length}`);

  if (Object.keys(typeCounts).length > 0) {
    console.log('\n  Detected types:');
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      const profile = getContractProfile(type as any);
      console.log(`    ${type} (${profile.displayName}): ${count}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
