-- AlterTable: Add OCR provider tracking fields to Contract
ALTER TABLE "Contract"
ADD COLUMN "ocrProvider" TEXT;
ALTER TABLE "Contract"
ADD COLUMN "ocrModel" TEXT;
ALTER TABLE "Contract"
ADD COLUMN "ocrProcessedAt" TIMESTAMP(3);