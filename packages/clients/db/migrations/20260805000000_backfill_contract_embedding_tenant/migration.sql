-- Backfill tenantId / contractType on ContractEmbedding from parent Contract.
-- Required for tenant-filtered hybrid/vector search (ce."tenantId").
-- Does NOT add NOT NULL yet — that lands after prod residual count is zero (Wave D).

UPDATE "ContractEmbedding" AS ce
SET
  "tenantId" = c."tenantId",
  "contractType" = COALESCE(ce."contractType", c."contractType"),
  "updatedAt" = NOW()
FROM "Contract" AS c
WHERE ce."contractId" = c.id
  AND (
    ce."tenantId" IS NULL
    OR ce."tenantId" = ''
    OR (ce."contractType" IS NULL AND c."contractType" IS NOT NULL)
  );
