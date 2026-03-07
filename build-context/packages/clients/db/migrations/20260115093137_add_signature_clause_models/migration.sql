-- CreateTable
CREATE TABLE "signature_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subject" TEXT,
    "message" TEXT,
    "created_by" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "signers" JSONB NOT NULL DEFAULT '[]',
    "webhook_events" JSONB DEFAULT '[]',
    "document_url" TEXT,
    "signed_document_url" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clause_library" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "plain_text" TEXT,
    "risk_level" TEXT NOT NULL DEFAULT 'MEDIUM',
    "is_standard" BOOLEAN NOT NULL DEFAULT false,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_negotiable" BOOLEAN NOT NULL DEFAULT true,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_id" TEXT,
    "jurisdiction" TEXT,
    "contract_types" JSONB NOT NULL DEFAULT '[]',
    "alternative_text" TEXT,
    "ai_embedding" BYTEA,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clause_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signature_requests_tenant_id_idx" ON "signature_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "signature_requests_contract_id_idx" ON "signature_requests"("contract_id");

-- CreateIndex
CREATE INDEX "signature_requests_status_idx" ON "signature_requests"("status");

-- CreateIndex
CREATE INDEX "signature_requests_provider_idx" ON "signature_requests"("provider");

-- CreateIndex
CREATE INDEX "signature_requests_external_id_idx" ON "signature_requests"("external_id");

-- CreateIndex
CREATE INDEX "signature_requests_tenant_id_status_idx" ON "signature_requests"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "clause_library_tenant_id_idx" ON "clause_library"("tenant_id");

-- CreateIndex
CREATE INDEX "clause_library_category_idx" ON "clause_library"("category");

-- CreateIndex
CREATE INDEX "clause_library_risk_level_idx" ON "clause_library"("risk_level");

-- CreateIndex
CREATE INDEX "clause_library_is_standard_idx" ON "clause_library"("is_standard");

-- CreateIndex
CREATE INDEX "clause_library_is_mandatory_idx" ON "clause_library"("is_mandatory");

-- CreateIndex
CREATE INDEX "clause_library_tenant_id_category_idx" ON "clause_library"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "clause_library_usage_count_idx" ON "clause_library"("usage_count" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "clause_library_tenant_id_name_version_key" ON "clause_library"("tenant_id", "name", "version");

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
