#!/usr/bin/env node
/**
 * Batch Migration Script for Contract Taxonomy
 * 
 * Migrates existing contracts to the new taxonomy system.
 * Run with: node scripts/migrate-contracts-to-taxonomy.js [options]
 * 
 * Options:
 *   --dry-run          Preview changes without applying them
 *   --tenant-id <id>   Migrate contracts for specific tenant only
 *   --batch-size <n>   Number of contracts to process at once (default: 10)
 *   --limit <n>        Maximum number of contracts to migrate
 *   --skip-classified  Skip contracts that already have taxonomy classification
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs').promises;

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  tenantId: args.includes('--tenant-id') ? args[args.indexOf('--tenant-id') + 1] : null,
  batchSize: args.includes('--batch-size') ? parseInt(args[args.indexOf('--batch-size') + 1]) : 10,
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null,
  skipClassified: args.includes('--skip-classified'),
};

console.log('📋 Migration Options:', options);

const prisma = new PrismaClient();

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

async function migrateContracts() {
  console.log('\n🚀 Starting contract taxonomy migration...\n');

  try {
    // Count total contracts to migrate
    const whereClause = {
      ...(options.tenantId && { tenantId: options.tenantId }),
      ...(options.skipClassified && { contractCategoryId: null }),
    };

    const totalCount = await prisma.contract.count({ where: whereClause });
    console.log(`📊 Found ${totalCount} contracts to migrate\n`);

    if (totalCount === 0) {
      console.log('✅ No contracts to migrate');
      return;
    }

    // Limit if specified
    const migrateCount = options.limit ? Math.min(totalCount, options.limit) : totalCount;
    
    if (options.limit) {
      console.log(`🎯 Limiting migration to ${migrateCount} contracts\n`);
    }

    // Statistics
    const stats = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      byCategory: {},
      errors: [],
    };

    // Process in batches
    let offset = 0;
    
    while (offset < migrateCount) {
      const batch = await prisma.contract.findMany({
        where: whereClause,
        take: options.batchSize,
        skip: offset,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fileName: true,
          contractType: true,
          contractTitle: true,
          description: true,
          storagePath: true,
          mimeType: true,
          contractCategoryId: true,
        },
      });

      console.log(`\n📦 Processing batch ${Math.floor(offset / options.batchSize) + 1} (${batch.length} contracts)...\n`);

      for (const contract of batch) {
        stats.total++;
        
        try {
          // Skip if already classified
          if (contract.contractCategoryId && options.skipClassified) {
            console.log(`⏭️  Skipping ${contract.fileName} - already classified`);
            stats.skipped++;
            continue;
          }

          // Read contract content for classification
          let textContent = '';
          
          // Try to read file content
          try {
            if (contract.storagePath && contract.mimeType === 'text/plain') {
              // For text files, read directly
              const filePath = path.resolve(process.cwd(), contract.storagePath);
              const fileContent = await fs.readFile(filePath, 'utf-8');
              textContent = fileContent.substring(0, 10000); // First 10KB
            } else {
              // For other files, use metadata
              textContent = [
                contract.fileName,
                contract.contractTitle,
                contract.contractType,
                contract.description,
              ].filter(Boolean).join(' ');
            }
          } catch (fileError) {
            console.warn(`⚠️  Could not read file for ${contract.fileName}, using metadata only`);
            textContent = [
              contract.fileName,
              contract.contractTitle,
              contract.contractType,
              contract.description,
            ].filter(Boolean).join(' ');
          }

          // Classify using taxonomy
          const { quickClassifyContract } = require('../apps/web/lib/ai/contract-classifier-taxonomy');
          
          console.log(`🔍 Classifying: ${contract.fileName}...`);
          
          const classification = await quickClassifyContract(textContent, contract.fileName);
          
          console.log(`   Category: ${classification.category_id}`);
          console.log(`   Subtype: ${classification.subtype || 'N/A'}`);
          console.log(`   Confidence: ${(classification.confidence * 100).toFixed(1)}%`);

          // Update statistics
          stats.byCategory[classification.category_id] = 
            (stats.byCategory[classification.category_id] || 0) + 1;

          // Update contract in database (unless dry run)
          if (!options.dryRun) {
            await prisma.contract.update({
              where: { id: contract.id },
              data: {
                contractCategoryId: classification.category_id,
                contractSubtype: classification.subtype,
                documentRole: classification.document_role,
                classificationConf: classification.confidence,
                classifiedAt: new Date(),
                pricingModels: classification.tags.pricing_models,
                deliveryModels: classification.tags.delivery_models,
                dataProfiles: classification.tags.data_profiles,
                riskFlags: classification.tags.risk_flags,
                classificationMeta: {
                  migrated: true,
                  migratedAt: new Date().toISOString(),
                  reasoning: classification.reasoning,
                },
              },
            });
            
            console.log(`   ✅ Updated in database`);
          } else {
            console.log(`   [DRY RUN] Would update with category: ${classification.category_id}`);
          }

          stats.success++;

        } catch (error) {
          console.error(`❌ Error processing ${contract.fileName}:`, error.message);
          stats.failed++;
          stats.errors.push({
            contractId: contract.id,
            fileName: contract.fileName,
            error: error.message,
          });
        }
      }

      offset += options.batchSize;

      // Add delay between batches to avoid rate limits
      if (offset < migrateCount) {
        console.log('\n⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Processed: ${stats.total}`);
    console.log(`✅ Success: ${stats.success}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    
    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were made to the database');
    }

    console.log('\n📂 Contracts by Category:');
    Object.entries(stats.byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(err => {
        console.log(`   ${err.fileName}: ${err.error}`);
      });
    }

    console.log('\n✅ Migration complete!\n');

    // Save detailed report
    if (!options.dryRun) {
      const reportPath = path.join(process.cwd(), 'logs', `migration-report-${Date.now()}.json`);
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        options,
        stats,
      }, null, 2));
      
      console.log(`📄 Detailed report saved to: ${reportPath}\n`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// MAIN
// ============================================================================

if (require.main === module) {
  migrateContracts()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { migrateContracts };
