-- CreateTable
CREATE TABLE IF NOT EXISTS "report_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "report_templates_tenant_id_idx" ON "report_templates"("tenant_id");
CREATE INDEX IF NOT EXISTS "report_templates_tenant_id_type_idx" ON "report_templates"("tenant_id", "type");
