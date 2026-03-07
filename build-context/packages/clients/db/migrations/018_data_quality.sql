-- Data Quality Score tracking
CREATE TABLE IF NOT EXISTS "DataQualityScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rateCardEntryId" TEXT NOT NULL,
    "overallScore" DECIMAL(5,2) NOT NULL,
    "completeness" DECIMAL(5,2) NOT NULL,
    "accuracy" DECIMAL(5,2) NOT NULL,
    "consistency" DECIMAL(5,2) NOT NULL,
    "timeliness" DECIMAL(5,2) NOT NULL,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "DataQualityScore_rateCardEntryId_fkey" 
        FOREIGN KEY ("rateCardEntryId") 
        REFERENCES "RateCardEntry"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for performance
CREATE INDEX "DataQualityScore_rateCardEntryId_idx" ON "DataQualityScore"("rateCardEntryId");
CREATE INDEX "DataQualityScore_overallScore_idx" ON "DataQualityScore"("overallScore");
CREATE INDEX "DataQualityScore_calculatedAt_idx" ON "DataQualityScore"("calculatedAt");

-- Composite index for filtering low-quality rates
CREATE INDEX "DataQualityScore_score_date_idx" ON "DataQualityScore"("overallScore", "calculatedAt");
