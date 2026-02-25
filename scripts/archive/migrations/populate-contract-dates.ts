#!/usr/bin/env npx ts-node

/**
 * Populate Contract Dates from Artifacts
 * 
 * This script extracts dates from OVERVIEW artifacts and populates the 
 * Contract table's date fields (startDate, endDate, effectiveDate, expirationDate)
 * 
 * Run: npx ts-node scripts/populate-contract-dates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OverviewData {
  effectiveDate?: string;
  expirationDate?: string;
  termStart?: string;
  termEnd?: string;
  startDate?: string;
  endDate?: string;
  termDuration?: string;
  term?: {
    startDate?: string;
    endDate?: string;
    duration?: string;
  };
}

function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  
  // Clean the date string
  const cleaned = dateStr.trim();
  
  // Try parsing various formats
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Try MM/DD/YYYY format
  const mmddyyyy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    return new Date(parseInt(mmddyyyy[3]), parseInt(mmddyyyy[1]) - 1, parseInt(mmddyyyy[2]));
  }
  
  // Try DD-MM-YYYY format
  const ddmmyyyy = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }
  
  // Try text formats like "January 1, 2024"
  const textDate = new Date(cleaned);
  if (!isNaN(textDate.getTime())) {
    return textDate;
  }
  
  console.log(`  Could not parse date: "${cleaned}"`);
  return null;
}

function extractDates(data: OverviewData): { startDate: Date | null; endDate: Date | null } {
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  
  // Try direct fields first - handle both string and Date formats
  const effectiveValue = (data as any).effectiveDate;
  const expirationValue = (data as any).expirationDate;
  
  if (effectiveValue) {
    if (typeof effectiveValue === 'string') {
      startDate = parseDate(effectiveValue);
    } else if (effectiveValue instanceof Date) {
      startDate = effectiveValue;
    }
  }
  
  if (!startDate) {
    startDate = parseDate(data.startDate) || 
                parseDate(data.termStart) ||
                parseDate(data.term?.startDate);
  }
              
  if (expirationValue) {
    if (typeof expirationValue === 'string') {
      endDate = parseDate(expirationValue);
    } else if (expirationValue instanceof Date) {
      endDate = expirationValue;
    }
  }
  
  if (!endDate) {
    endDate = parseDate(data.endDate) || 
              parseDate(data.termEnd) ||
              parseDate(data.term?.endDate);
  }
            
  return { startDate, endDate };
}

async function main() {
  console.log('🗓️  Contract Date Population Script\n');
  console.log('='.repeat(50));
  
  // Get contracts without dates
  const contractsWithoutDates = await prisma.contract.findMany({
    where: {
      OR: [
        { endDate: null },
        { expirationDate: null },
        { startDate: null },
        { effectiveDate: null },
      ],
    },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: { id: true, type: true, data: true },
      },
    },
  });
  
  console.log(`\n📋 Found ${contractsWithoutDates.length} contracts with missing dates\n`);
  
  let updated = 0;
  let skipped = 0;
  let noArtifact = 0;
  
  for (const contract of contractsWithoutDates) {
    const contractName = contract.contractTitle || contract.originalName || contract.fileName;
    console.log(`\n📄 ${contractName.substring(0, 50)}...`);
    
    const overviewArtifact = contract.artifacts.find(a => a.type === 'OVERVIEW');
    
    if (!overviewArtifact?.data) {
      console.log('   ⚠️  No OVERVIEW artifact found');
      noArtifact++;
      continue;
    }
    
    const overviewData = overviewArtifact.data as OverviewData;
    const { startDate, endDate } = extractDates(overviewData);
    
    if (!startDate && !endDate) {
      console.log('   ⚠️  No dates found in artifact');
      console.log(`   Raw data keys: ${Object.keys(overviewData).join(', ')}`);
      skipped++;
      continue;
    }
    
    // Update the contract
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        ...(startDate && { startDate, effectiveDate: startDate }),
        ...(endDate && { endDate, expirationDate: endDate }),
        updatedAt: new Date(),
      },
    });
    
    console.log(`   ✅ Updated dates:`);
    if (startDate) console.log(`      Start: ${startDate.toISOString().split('T')[0]}`);
    if (endDate) console.log(`      End: ${endDate.toISOString().split('T')[0]}`);
    updated++;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated} contracts`);
  console.log(`   ⚠️  No artifact: ${noArtifact} contracts`);
  console.log(`   ⏭️  Skipped (no dates in artifact): ${skipped} contracts`);
  
  // Show contracts that now have dates
  const contractsWithDates = await prisma.contract.count({
    where: {
      OR: [
        { endDate: { not: null } },
        { expirationDate: { not: null } },
      ],
    },
  });
  
  const upcomingRenewals = await prisma.contract.count({
    where: {
      OR: [
        { endDate: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } },
        { expirationDate: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  
  console.log(`\n📅 Database Status:`);
  console.log(`   Contracts with expiration dates: ${contractsWithDates}`);
  console.log(`   Renewals in next 90 days: ${upcomingRenewals}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
