/**
 * One-off cleanup for the legacy bulk "Verify all" bug (fixed 2026-07-13).
 *
 * The old allFields branch of PUT /api/contracts/[id]/metadata/validate merged
 * raw metadata VALUES into ContractMetadata.customFields alongside a
 * _validationStatus summary. customFields should only hold _fieldValidations,
 * _reviewStatus, and genuine custom fields.
 *
 * This script lists affected rows (dry run by default) and, with --apply,
 * strips stray keys that exactly match enterprise metadata schema field keys.
 * It NEVER deletes _fieldValidations / _reviewStatus or non-schema keys.
 *
 * Usage:
 *   npx tsx scripts/cleanup-validation-customfields.ts            # list only
 *   npx tsx scripts/cleanup-validation-customfields.ts --apply    # strip stray keys
 */
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { CONTRACT_METADATA_FIELDS } = require('../apps/web/lib/types/contract-metadata-schema') as {
  CONTRACT_METADATA_FIELDS: Array<{ key: string }>;
};

const prisma = new PrismaClient();

const apply = process.argv.includes('--apply');

// Keys this cleanup must never touch.
const PROTECTED_KEYS = new Set(['_fieldValidations', '_reviewStatus', '_validationStatus']);
const SCHEMA_FIELD_KEYS = new Set(CONTRACT_METADATA_FIELDS.map((field) => field.key));

async function main() {
  const rows = await prisma.contractMetadata.findMany({
    select: { contractId: true, tenantId: true, customFields: true },
  });

  const legacyRows = rows.filter((row) => {
    const customFields = (row.customFields as Record<string, unknown>) || {};
    return '_validationStatus' in customFields;
  });

  console.log(`Found ${legacyRows.length} ContractMetadata row(s) with a legacy _validationStatus summary.`);

  let affected = 0;
  for (const row of legacyRows) {
    const customFields = (row.customFields as Record<string, unknown>) || {};
    const strayKeys = Object.keys(customFields).filter(
      (key) => !PROTECTED_KEYS.has(key) && SCHEMA_FIELD_KEYS.has(key),
    );
    const unknownKeys = Object.keys(customFields).filter(
      (key) => !PROTECTED_KEYS.has(key) && !SCHEMA_FIELD_KEYS.has(key),
    );

    if (strayKeys.length === 0) continue;
    affected += 1;

    console.log(`\ncontract ${row.contractId} (tenant ${row.tenantId}):`);
    console.log(`  stray schema-value keys: ${strayKeys.join(', ')}`);
    if (unknownKeys.length > 0) {
      console.log(`  untouched non-schema keys: ${unknownKeys.join(', ')}`);
    }

    if (apply) {
      const cleaned = { ...customFields };
      for (const key of strayKeys) delete cleaned[key];
      delete cleaned._validationStatus;
      await prisma.contractMetadata.update({
        where: { contractId: row.contractId },
        data: { customFields: cleaned },
      });
      console.log('  -> cleaned');
    }
  }

  console.log(`\n${affected} row(s) affected.${apply ? ' Cleanup applied.' : ' Dry run — re-run with --apply to clean.'}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
