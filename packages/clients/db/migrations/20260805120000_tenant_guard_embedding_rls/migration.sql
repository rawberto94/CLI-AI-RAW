-- Wave D: embedding tenant integrity + staged RLS (ENABLE, not FORCE)
-- SAFE: does not FORCE ROW LEVEL SECURITY (table owners still bypass until soak)
-- After staging verification, a follow-up migration may FORCE RLS per table.

-- ── 1. Backfill ContractEmbedding.tenantId / contractType from parent Contract ─
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

-- Orphan chunks with no parent contract cannot be tenant-scoped — drop them
DELETE FROM "ContractEmbedding" ce
WHERE ce."tenantId" IS NULL
   OR ce."tenantId" = '';

-- ── 2. Enforce NOT NULL tenantId on embeddings ───────────────────────────────
ALTER TABLE "ContractEmbedding"
  ALTER COLUMN "tenantId" SET NOT NULL;

-- ── 3. Session helpers (pool-safe SET LOCAL via set_config isLocal=true) ──────
CREATE OR REPLACE FUNCTION set_app_tenant(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_id, true);
  PERFORM set_config('app.current_tenant', tenant_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_app_tenant()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(current_setting('app.tenant_id', true), ''),
    NULLIF(current_setting('app.current_tenant', true), '')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ── 4. RLS ENABLE + tenant policies (current schema only) ────────────────────
-- Policy: row visible/writable when session tenant matches, or session tenant empty
-- (empty session = migration/superuser tooling; app should always set tenant).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Contract',
    'Artifact',
    'ContractEmbedding',
    'ContractMetadata',
    'Obligation',
    'ContractVersion',
    'ProcessingJob',
    'AiDecision'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- Drop prior policy if re-running
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_write ON %I', t);

    -- SELECT
    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I FOR SELECT
       USING (
         current_app_tenant() IS NULL
         OR current_app_tenant() = ''''
         OR "tenantId" = current_app_tenant()
       )',
      t
    );

    -- INSERT / UPDATE / DELETE (WITH CHECK on write)
    EXECUTE format(
      'CREATE POLICY tenant_isolation_write ON %I FOR ALL
       USING (
         current_app_tenant() IS NULL
         OR current_app_tenant() = ''''
         OR "tenantId" = current_app_tenant()
       )
       WITH CHECK (
         current_app_tenant() IS NULL
         OR current_app_tenant() = ''''
         OR "tenantId" = current_app_tenant()
       )',
      t
    );
  END LOOP;
END
$$;

-- NOTE: FORCE ROW LEVEL SECURITY is intentionally NOT applied here.
-- Enable per-table after staging soak:
--   ALTER TABLE "Contract" FORCE ROW LEVEL SECURITY;
