/**
 * Resumable policy evaluation backfill.
 * Additive only — creates PolicyEvaluation rows; never deletes contracts.
 *
 * Usage:
 *   npx tsx scripts/backfill-policy-evaluations.ts --tenant <tenantId> [--limit 100] [--pack <packId>]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  const tenantId = arg('tenant');
  if (!tenantId) {
    console.error('Required: --tenant <tenantId>');
    process.exit(1);
  }
  const limit = Number(arg('limit') || 100);
  const packId = arg('pack');

  const { evaluatePolicyPack } = await import(
    '../packages/data-orchestration/src/services/policy/index'
  );

  const contracts = await prisma.contract.findMany({
    where: {
      tenantId,
      isDeleted: false,
      rawText: { not: null },
    },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Backfilling policy evaluations for ${contracts.length} contracts…`);
  let ok = 0;
  let fail = 0;
  let cached = 0;

  for (const c of contracts) {
    try {
      const result = await evaluatePolicyPack({
        tenantId,
        contractId: c.id,
        packId,
        triggeredBy: 'backfill',
        allowSemantic: false,
        prisma,
      });
      if (result.cached) cached += 1;
      else ok += 1;
      console.log(`  ${c.id}: ${result.status} score=${result.policyScore}${result.cached ? ' (cache)' : ''}`);
    } catch (e: any) {
      fail += 1;
      console.error(`  ${c.id}: ERROR ${e?.message}`);
    }
  }

  console.log(`Done. evaluated=${ok} cached=${cached} failed=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
