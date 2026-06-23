/**
 * Backfill script: populate TenantTag.usageCount and ContractGroup.contractCount
 * from live contract metadata and tag usage.
 *
 * Run: pnpm tsx scripts/backfill-tag-usage.ts
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface SmartGroupQuery {
  status?: string[];
  contractType?: string[];
  categoryL1?: string[];
  search?: string;
  minValue?: number;
  maxValue?: number;
}

function parseSmartQuery(raw: unknown): SmartGroupQuery {
  if (!raw || typeof raw !== 'object') return {};
  const candidate = raw as Record<string, unknown>;
  const toStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const values = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    return values.length > 0 ? values : undefined;
  };

  const minValue = typeof candidate.minValue === 'number' ? candidate.minValue : undefined;
  const maxValue = typeof candidate.maxValue === 'number' ? candidate.maxValue : undefined;

  return {
    status: toStringArray(candidate.status),
    contractType: toStringArray(candidate.contractType),
    categoryL1: toStringArray(candidate.categoryL1),
    search: typeof candidate.search === 'string' ? candidate.search.trim() : undefined,
    minValue,
    maxValue,
  };
}

async function backfillTagUsageCounts() {
  console.log('⏳ Backfilling TenantTag.usageCount...');

  const allTags = await prisma.tenantTag.findMany({
    select: { id: true, tenantId: true, name: true, slug: true },
  });

  let updated = 0;
  for (const tag of allTags) {
    const normalizedName = tag.name.toLowerCase();
    const count = await prisma.contract.count({
      where: {
        tenantId: tag.tenantId,
        isDeleted: false,
        tags: {
          hasSome: [normalizedName],
        },
      },
    });

    if (count > 0) {
      await prisma.tenantTag.update({
        where: { id: tag.id },
        data: { usageCount: count },
      });
      updated += 1;
    }
  }

  console.log(`✅ Updated ${updated} tag usage counts`);
}

async function backfillGroupContractCounts() {
  console.log('⏳ Backfilling ContractGroup.contractCount...');

  const groups = await prisma.contractGroup.findMany({
    select: { id: true, tenantId: true, groupType: true, contractIds: true, query: true, requireAllTags: true, requireAnyTags: true },
  });

  let updated = 0;
  for (const group of groups) {
    let count = 0;

    if (group.groupType === 'static') {
      count = group.contractIds?.length ?? 0;
    } else if (group.groupType === 'smart') {
      const smart = parseSmartQuery(group.query);
      const whereBase: Prisma.ContractWhereInput = {
        tenantId: group.tenantId,
        isDeleted: false,
      };

      const where: Prisma.ContractWhereInput = {
        ...whereBase,
        ...(smart.status?.length ? { status: { in: smart.status } } : {}),
        ...(smart.contractType?.length ? { contractType: { in: smart.contractType } } : {}),
        ...(smart.categoryL1?.length ? { categoryL1: { in: smart.categoryL1 } } : {}),
        ...(smart.search
          ? {
              OR: [
                { contractTitle: { contains: smart.search, mode: 'insensitive' } },
                { fileName: { contains: smart.search, mode: 'insensitive' } },
                { clientName: { contains: smart.search, mode: 'insensitive' } },
                { supplierName: { contains: smart.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(smart.minValue !== undefined ? { totalValue: { gte: smart.minValue } } : {}),
        ...(smart.maxValue !== undefined ? { totalValue: { lte: smart.maxValue } } : {}),
      };

      const contracts = await prisma.contract.findMany({
        where,
        select: { metadata: { select: { tags: true } } },
        take: 1000,
      });

      const requireAll = (group.requireAllTags || []).map((tag) => tag.toLowerCase()).filter(Boolean);
      const requireAny = (group.requireAnyTags || []).map((tag) => tag.toLowerCase()).filter(Boolean);

      count = contracts.filter((contract) => {
        const tags = new Set((contract.metadata?.tags || []).map((tag) => tag.toLowerCase()));
        if (requireAll.length > 0 && requireAll.some((tag) => !tags.has(tag))) return false;
        if (requireAny.length > 0 && !requireAny.some((tag) => tags.has(tag))) return false;
        return true;
      }).length;
    }

    if (count !== group.contractCount ?? 0) {
      await prisma.contractGroup.update({
        where: { id: group.id },
        data: { contractCount: count },
      });
      updated += 1;
    }
  }

  console.log(`✅ Updated ${updated} group contract counts`);
}

async function main() {
  try {
    console.log('🔄 Starting tag/group backfill...\n');
    await backfillTagUsageCounts();
    await backfillGroupContractCounts();
    console.log('\n✨ Backfill complete!');
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
