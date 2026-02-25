#!/usr/bin/env npx tsx
/**
 * Populate rawText for contracts from various sources
 * - From artifact OVERVIEW data
 * - From stored files
 * - From JSON mock data
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Populating rawText for contracts...\n');

  // Get all contracts without rawText
  const contracts = await prisma.contract.findMany({
    where: {
      OR: [
        { rawText: null },
        { rawText: '' },
      ],
    },
    include: {
      artifacts: {
        where: {
          type: { in: ['OVERVIEW', 'CLAUSES', 'RISK', 'FINANCIAL', 'COMPLIANCE'] },
        },
      },
    },
  });

  console.log(`📄 Found ${contracts.length} contracts without rawText\n`);

  let updated = 0;
  let skipped = 0;

  for (const contract of contracts) {
    console.log(`Processing: ${contract.filename || contract.id}`);

    // Try to build text from artifacts
    let text = '';
    
    for (const artifact of contract.artifacts) {
      const data = artifact.data as any;
      
      if (artifact.type === 'OVERVIEW' && data) {
        if (data.summary) text += `\n## Summary\n${data.summary}\n`;
        if (data.parties && data.parties.length > 0) {
          text += `\n## Parties\n${data.parties.map((p: any) => `- ${p.name}: ${p.role}`).join('\n')}\n`;
        }
        if (data.keyTerms && data.keyTerms.length > 0) {
          text += `\n## Key Terms\n${data.keyTerms.join(', ')}\n`;
        }
        if (data.totalValue) {
          text += `\n## Value\n${data.currency || 'USD'} ${data.totalValue}\n`;
        }
        if (data.effectiveDate) {
          text += `Effective Date: ${data.effectiveDate}\n`;
        }
        if (data.expirationDate) {
          text += `Expiration Date: ${data.expirationDate}\n`;
        }
      }

      if (artifact.type === 'CLAUSES' && data?.clauses) {
        text += `\n## Clauses\n`;
        for (const clause of data.clauses.slice(0, 10)) {
          text += `\n### ${clause.type || clause.title || 'Clause'}\n`;
          text += `${clause.text || clause.content || ''}\n`;
        }
      }

      if (artifact.type === 'RISK' && data) {
        text += `\n## Risk Assessment\n`;
        if (data.overallScore !== undefined) {
          text += `Risk Score: ${data.overallScore}/100\n`;
        }
        if (data.risks && data.risks.length > 0) {
          for (const risk of data.risks.slice(0, 5)) {
            text += `- ${risk.type || risk.category}: ${risk.description || risk.text} (${risk.severity})\n`;
          }
        }
      }

      if (artifact.type === 'FINANCIAL' && data) {
        text += `\n## Financial Terms\n`;
        if (data.totalValue) text += `Total Value: ${data.currency || 'USD'} ${data.totalValue}\n`;
        if (data.paymentTerms) text += `Payment Terms: ${data.paymentTerms}\n`;
        if (data.billingFrequency) text += `Billing: ${data.billingFrequency}\n`;
      }

      if (artifact.type === 'COMPLIANCE' && data) {
        text += `\n## Compliance\n`;
        if (data.status) text += `Status: ${data.status}\n`;
        if (data.standards && data.standards.length > 0) {
          text += `Standards: ${data.standards.join(', ')}\n`;
        }
      }
    }

    // If we still don't have text, try to read from file storage
    if (!text.trim() && contract.storagePath) {
      try {
        const fullPath = path.join('/workspaces/CLI-AI-RAW', contract.storagePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.length > 50) {
            text = content;
            console.log(`  📁 Read from storage: ${contract.storagePath}`);
          }
        }
      } catch (e) {
        // Skip file read errors
      }
    }

    // Check demo data files
    if (!text.trim()) {
      const demoFiles = [
        '/workspaces/CLI-AI-RAW/data/contracts/contract_demo_001.json',
        '/workspaces/CLI-AI-RAW/data/test-sow-with-rates.json',
      ];
      
      for (const demoFile of demoFiles) {
        try {
          if (fs.existsSync(demoFile)) {
            const json = JSON.parse(fs.readFileSync(demoFile, 'utf-8'));
            if (json.originalContent && json.originalContent.length > 100) {
              text = json.originalContent;
              console.log(`  📋 Using demo content from ${path.basename(demoFile)}`);
              break;
            }
          }
        } catch (e) {
          // Skip
        }
      }
    }

    // Update if we have content
    if (text.trim().length >= 100) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { 
          rawText: text.trim(),
          searchableText: text.trim().toLowerCase(),
        },
      });
      console.log(`  ✅ Updated rawText (${text.trim().length} chars)`);
      updated++;
    } else {
      console.log(`  ⚠️  Skipped - insufficient content (${text.trim().length} chars)`);
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);

  // Show final counts
  const withText = await prisma.contract.count({
    where: { 
      rawText: { not: null },
      NOT: { rawText: '' },
    },
  });
  console.log(`\n📈 Contracts with rawText: ${withText}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
