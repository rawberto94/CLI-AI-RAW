-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('INGESTION', 'OVERVIEW', 'CLAUSES', 'RATES', 'COMPLIANCE', 'BENCHMARK', 'RISK', 'REPORT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "data" JSONB NOT NULL,
    "schemaVersion" TEXT DEFAULT 'v1',
    "hash" TEXT,
    "location" TEXT,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "contractId" TEXT,
    "tenantId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "summary" TEXT,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

-- CreateIndex
CREATE INDEX "Contract_tenantId_idx" ON "Contract"("tenantId");

-- CreateIndex
CREATE INDEX "Artifact_contractId_idx" ON "Artifact"("contractId");

-- CreateIndex
CREATE INDEX "Artifact_tenantId_idx" ON "Artifact"("tenantId");

-- CreateIndex
CREATE INDEX "Artifact_contractId_type_idx" ON "Artifact"("contractId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Run_runId_key" ON "Run"("runId");

-- CreateIndex
CREATE INDEX "Run_runId_idx" ON "Run"("runId");

-- CreateIndex
CREATE INDEX "Run_contractId_idx" ON "Run"("contractId");

-- CreateIndex
CREATE INDEX "Run_tenantId_idx" ON "Run"("tenantId");

-- CreateIndex
CREATE INDEX "Embedding_contractId_idx" ON "Embedding"("contractId");

-- CreateIndex
CREATE INDEX "Embedding_tenantId_idx" ON "Embedding"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_contractId_chunkIndex_key" ON "Embedding"("contractId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Embedding" ADD COLUMN     "embedding_vector" vector(1536);

-- CreateIndex
CREATE INDEX "Embedding_embedding_vector_idx" ON "Embedding" USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);
