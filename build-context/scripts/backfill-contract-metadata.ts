#!/usr/bin/env node
/**
 * Backfill Contract Metadata Script
 * 
 * This script populates contract display columns from OVERVIEW artifacts
 * for contracts that were processed before the auto-sync feature was added.
 * 
 * Usage:
 *   npx tsx scripts/backfill-contract-metadata.ts [options]
 * 
 * Options:
 *   --dry-run       Preview changes without applying them
 *   --tenant=ID     Process only contracts for a specific tenant
 *   --limit=N       Process only N contracts
 *   --force         Overwrite existing values (except for "UNKNOWN" types which are always updated)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OverviewData {
  contractType?: string;
  parties?: Array<{
    role?: string;
    name?: string;
  }> | {
    client?: string | { name?: string };
    supplier?: string | { name?: string };
  };
  totalValue?: number | string;
  currency?: string;
  dates?: {
    effective?: string;
    expiration?: string;
    start?: string;
    end?: string;
  };
  effectiveDate?: string;
  expirationDate?: string;
  startDate?: string;
  endDate?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const tenantArg = args.find(a => a.startsWith('--tenant='));
  const limitArg = args.find(a => a.startsWith('--limit='));
  
  const tenantId = tenantArg?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
  
  console.log('🔄 Contract Metadata Backfill Script');
  console.log('=====================================');
  if (dryRun) console.log('📋 DRY RUN MODE - No changes will be made');
  if (force) console.log('⚡ FORCE MODE - Will overwrite existing values');
  if (tenantId) console.log(`📁 Tenant filter: ${tenantId}`);
  if (limit) console.log(`📊 Limit: ${limit}`);
  console.log('');

  // Find ALL completed contracts with OVERVIEW artifacts for force mode
  // Or just those missing metadata for normal mode
  const whereClause: any = {
    status: 'COMPLETED',
    ...(tenantId ? { tenantId } : {}),
    artifacts: {
      some: {
        type: 'OVERVIEW'
      }
    }
  };
  
  if (!force) {
    whereClause.OR = [
      { contractType: null },
      { contractType: 'UNKNOWN' },
      { clientName: null },
      { supplierName: null },
      { totalValue: null },
      { effectiveDate: null },
      { expirationDate: null }
    ];
  }

  const contracts = await prisma.contract.findMany({
    where: whereClause,
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        take: 1
      }
    },
    take: limit
  });

  console.log(`📊 Found ${contracts.length} contracts to process\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const contract of contracts) {
    const artifact = contract.artifacts[0];
    if (!artifact?.data) {
      console.log(`⚠️  Contract ${contract.id} (${contract.contractTitle || 'untitled'}): No OVERVIEW data`);
      skipped++;
      continue;
    }

    try {
      const overview = artifact.data as unknown as OverviewData;
      
      const updateData: Record<string, unknown> = {};
      
      // Contract type - update if null, "UNKNOWN", or force mode
      const shouldUpdateType = !contract.contractType || contract.contractType === 'UNKNOWN' || force;
      if (shouldUpdateType && overview.contractType && overview.contractType !== 'UNKNOWN') {
        updateData.contractType = overview.contractType;
      }
      
      // Parties - handle array format with various role names
      if (Array.isArray(overview.parties)) {
        for (const party of overview.parties) {
          const roleLower = party.role?.toLowerCase() || '';
          // Client roles
          const isClient = ['client', 'buyer', 'customer', 'purchaser'].includes(roleLower);
          // Supplier roles  
          const isSupplier = ['supplier', 'vendor', 'service provider', 'provider', 'contractor', 'seller'].includes(roleLower);
          
          if (isClient && (!contract.clientName || force) && party.name) {
            updateData.clientName = party.name;
          }
          if (isSupplier && (!contract.supplierName || force) && party.name) {
            updateData.supplierName = party.name;
          }
        }
        
        // If no specific roles found, use first party as supplier/counterparty
        if (!updateData.supplierName && !contract.supplierName && overview.parties.length > 0) {
          updateData.supplierName = overview.parties[0].name;
        }
      } else if (overview.parties) {
        // Handle object format
        if ((!contract.clientName || force) && overview.parties.client) {
          updateData.clientName = typeof overview.parties.client === 'string' 
            ? overview.parties.client 
            : overview.parties.client?.name;
        }
        if ((!contract.supplierName || force) && overview.parties.supplier) {
          updateData.supplierName = typeof overview.parties.supplier === 'string'
            ? overview.parties.supplier
            : overview.parties.supplier?.name;
        }
      }
      
      // Total value
      const shouldUpdateValue = contract.totalValue === null || force;
      if (shouldUpdateValue && overview.totalValue !== undefined && overview.totalValue !== 0) {
        const value = typeof overview.totalValue === 'string'
          ? parseFloat(overview.totalValue.replace(/[^0-9.-]/g, ''))
          : overview.totalValue;
        if (!isNaN(value) && value !== 0) {
          updateData.totalValue = value;
        }
      }
      
      // Currency
      if ((!contract.currency || force) && overview.currency) {
        updateData.currency = overview.currency;
      }
      
      // Dates
      const effectiveDate = overview.dates?.effective || overview.dates?.start || overview.effectiveDate || overview.startDate;
      const expirationDate = overview.dates?.expiration || overview.dates?.end || overview.expirationDate || overview.endDate;
      
      if ((!contract.effectiveDate || force) && effectiveDate) {
        const date = new Date(effectiveDate);
        if (!isNaN(date.getTime())) {
          updateData.effectiveDate = date;
        }
      }
      
      if ((!contract.expirationDate || force) && expirationDate) {
        const date = new Date(expirationDate);
        if (!isNaN(date.getTime())) {
          updateData.expirationDate = date;
        }
      }
      
      if (Object.keys(updateData).length === 0) {
        console.log(`⏭️  Contract ${contract.id} (${contract.contractTitle || 'untitled'}): No updates needed`);
        skipped++;
        continue;
      }
      
      console.log(`✅ Contract ${contract.id} (${contract.contractTitle || 'untitled'}):`);
      for (const [key, value] of Object.entries(updateData)) {
        console.log(`   • ${key}: ${value}`);
      }
      
      if (!dryRun) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: updateData
        });
      }
      
      updated++;
    } catch (error) {
      console.error(`❌ Contract ${contract.id} (${contract.contractTitle || 'untitled'}): Error - ${error}`);
      errors++;
    }
  }

  console.log('\n=====================================');
  console.log('📊 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  
  if (dryRun && updated > 0) {
    console.log('\n💡 Run without --dry-run to apply these changes');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
