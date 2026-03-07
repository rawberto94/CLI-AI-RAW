-- CreateTable
CREATE TABLE "extraction_corrections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "original_value" TEXT,
    "corrected_value" TEXT,
    "confidence" DECIMAL(3,2),
    "was_correct" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "feedback_type" TEXT NOT NULL,
    "contract_type" TEXT,
    "document_length" INTEGER,
    "model_used" TEXT,
    "prompt_version" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_corrections_tenant_id_idx" ON "extraction_corrections"("tenant_id");

-- CreateIndex
CREATE INDEX "extraction_corrections_contract_id_idx" ON "extraction_corrections"("contract_id");

-- CreateIndex
CREATE INDEX "extraction_corrections_field_name_idx" ON "extraction_corrections"("field_name");

-- CreateIndex
CREATE INDEX "extraction_corrections_feedback_type_idx" ON "extraction_corrections"("feedback_type");

-- CreateIndex
CREATE INDEX "extraction_corrections_was_correct_idx" ON "extraction_corrections"("was_correct");

-- CreateIndex
CREATE INDEX "extraction_corrections_contract_type_idx" ON "extraction_corrections"("contract_type");

-- CreateIndex
CREATE INDEX "extraction_corrections_created_at_idx" ON "extraction_corrections"("created_at");

-- CreateIndex
CREATE INDEX "extraction_corrections_tenant_id_field_name_idx" ON "extraction_corrections"("tenant_id", "field_name");

-- CreateIndex
CREATE INDEX "extraction_corrections_tenant_id_contract_type_field_name_idx" ON "extraction_corrections"("tenant_id", "contract_type", "field_name");

-- CreateIndex
CREATE INDEX "extraction_corrections_tenant_id_was_correct_idx" ON "extraction_corrections"("tenant_id", "was_correct");

-- AddForeignKey
ALTER TABLE "extraction_corrections" ADD CONSTRAINT "extraction_corrections_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
