-- AlterTable
ALTER TABLE "Artifact" ADD COLUMN     "accuracyScore" INTEGER DEFAULT 0,
ADD COLUMN     "completenessScore" INTEGER DEFAULT 0,
ADD COLUMN     "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "feedbackAt" TIMESTAMP(3),
ADD COLUMN     "feedbackBy" TEXT,
ADD COLUMN     "feedbackNotes" TEXT,
ADD COLUMN     "generationVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isUserVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "modelUsed" TEXT,
ADD COLUMN     "parentArtifactId" TEXT,
ADD COLUMN     "processingCost" DECIMAL(10,6),
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "qualityScore" INTEGER DEFAULT 0,
ADD COLUMN     "regeneratedAt" TIMESTAMP(3),
ADD COLUMN     "regeneratedBy" TEXT,
ADD COLUMN     "regenerationReason" TEXT,
ADD COLUMN     "tokensUsed" INTEGER,
ADD COLUMN     "userRating" INTEGER,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "annualValue" DECIMAL(15,2),
ADD COLUMN     "autoRenewalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "daysUntilExpiry" INTEGER,
ADD COLUMN     "expirationAlertAt" TIMESTAMP(3),
ADD COLUMN     "expirationAlertSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expirationRisk" TEXT DEFAULT 'LOW',
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "importSource" TEXT,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "isExpired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "monthlyValue" DECIMAL(15,2),
ADD COLUMN     "noticePeriodDays" INTEGER,
ADD COLUMN     "paymentFrequency" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "renewalCompletedAt" TIMESTAMP(3),
ADD COLUMN     "renewalInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "renewalInitiatedBy" TEXT,
ADD COLUMN     "renewalNotes" TEXT,
ADD COLUMN     "renewalStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN     "renewalTerms" JSONB,
ADD COLUMN     "sourceMetadata" JSONB,
ADD COLUMN     "terminationClause" TEXT;

-- AlterTable
ALTER TABLE "contract_metadata" ADD COLUMN     "activeIssues" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aiAnalysisVersion" TEXT,
ADD COLUMN     "aiKeyInsights" JSONB DEFAULT '[]',
ADD COLUMN     "aiRecommendations" JSONB DEFAULT '[]',
ADD COLUMN     "aiRiskFactors" JSONB DEFAULT '[]',
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedBy" TEXT,
ADD COLUMN     "embeddingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "embeddingVersion" TEXT,
ADD COLUMN     "expirationAction" TEXT,
ADD COLUMN     "expirationActionAt" TIMESTAMP(3),
ADD COLUMN     "expirationActionBy" TEXT,
ADD COLUMN     "expirationHandled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "issueCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAiAnalysis" TIMESTAMP(3),
ADD COLUMN     "lastEmbeddingAt" TIMESTAMP(3),
ADD COLUMN     "lastIssueAt" TIMESTAMP(3),
ADD COLUMN     "lastNegotiatedAt" TIMESTAMP(3),
ADD COLUMN     "lastNegotiatedBy" TEXT,
ADD COLUMN     "lastRenewalDate" TIMESTAMP(3),
ADD COLUMN     "negotiationNotes" TEXT,
ADD COLUMN     "negotiationRound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "negotiationStartedAt" TIMESTAMP(3),
ADD COLUMN     "negotiationStatus" TEXT,
ADD COLUMN     "performanceNotes" TEXT,
ADD COLUMN     "performanceScore" INTEGER DEFAULT 0,
ADD COLUMN     "renewalChecklist" JSONB DEFAULT '[]',
ADD COLUMN     "renewalChecklistDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "renewalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "renewalDeadline" TIMESTAMP(3),
ADD COLUMN     "renewalOwner" TEXT,
ADD COLUMN     "renewalPriority" TEXT DEFAULT 'NORMAL',
ADD COLUMN     "resolvedIssues" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slaComplianceRate" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "contract_health_scores" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "overall_score" INTEGER NOT NULL DEFAULT 0,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "compliance_score" INTEGER NOT NULL DEFAULT 0,
    "financial_score" INTEGER NOT NULL DEFAULT 0,
    "operational_score" INTEGER NOT NULL DEFAULT 0,
    "renewal_readiness" INTEGER NOT NULL DEFAULT 0,
    "document_quality" INTEGER NOT NULL DEFAULT 0,
    "factors" JSONB NOT NULL DEFAULT '[]',
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "opportunities" JSONB NOT NULL DEFAULT '[]',
    "previous_score" INTEGER,
    "score_change" INTEGER NOT NULL DEFAULT 0,
    "trend_direction" TEXT NOT NULL DEFAULT 'stable',
    "trend_history" JSONB NOT NULL DEFAULT '[]',
    "alert_level" TEXT NOT NULL DEFAULT 'none',
    "active_alerts" JSONB NOT NULL DEFAULT '[]',
    "alert_count" INTEGER NOT NULL DEFAULT 0,
    "last_alert_at" TIMESTAMP(3),
    "industry_average" INTEGER,
    "percentile_rank" INTEGER,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_health_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_expirations" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "days_until_expiry" INTEGER NOT NULL,
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "expired_at" TIMESTAMP(3),
    "expiration_risk" TEXT NOT NULL DEFAULT 'LOW',
    "risk_factors" JSONB NOT NULL DEFAULT '[]',
    "impact_score" INTEGER NOT NULL DEFAULT 0,
    "contract_value" DECIMAL(15,2),
    "annual_value" DECIMAL(15,2),
    "value_at_risk" DECIMAL(15,2),
    "renewal_status" TEXT NOT NULL DEFAULT 'PENDING',
    "renewal_probability" DECIMAL(5,2),
    "recommended_action" TEXT,
    "owner_id" TEXT,
    "owner_name" TEXT,
    "assigned_to" TEXT,
    "assigned_at" TIMESTAMP(3),
    "alerts_sent" JSONB NOT NULL DEFAULT '[]',
    "last_alert_sent" TIMESTAMP(3),
    "next_alert_due" TIMESTAMP(3),
    "alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notice_period_days" INTEGER,
    "notice_deadline" TIMESTAMP(3),
    "notice_given" BOOLEAN NOT NULL DEFAULT false,
    "notice_given_at" TIMESTAMP(3),
    "notice_given_by" TEXT,
    "auto_renewal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_renewal_terms" JSONB,
    "resolution" TEXT,
    "resolution_date" TIMESTAMP(3),
    "resolution_by" TEXT,
    "resolution_notes" TEXT,
    "new_contract_id" TEXT,
    "contract_title" TEXT,
    "supplier_name" TEXT,
    "client_name" TEXT,
    "contract_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_expirations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expiration_alerts" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "sent_to" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_action" TEXT,
    "snooze_until" TIMESTAMP(3),
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "days_before_expiry" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expiration_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_history" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "renewal_number" INTEGER NOT NULL,
    "renewal_type" TEXT NOT NULL,
    "previous_start_date" TIMESTAMP(3),
    "previous_end_date" TIMESTAMP(3),
    "previous_value" DECIMAL(15,2),
    "previous_terms" JSONB,
    "new_start_date" TIMESTAMP(3) NOT NULL,
    "new_end_date" TIMESTAMP(3) NOT NULL,
    "new_value" DECIMAL(15,2),
    "new_terms" JSONB,
    "value_change" DECIMAL(15,2),
    "value_change_percent" DECIMAL(5,2),
    "term_extension" INTEGER,
    "negotiation_days" INTEGER,
    "negotiation_rounds" INTEGER,
    "key_changes" JSONB DEFAULT '[]',
    "initiated_by" TEXT,
    "initiated_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renewal_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_health_scores_contract_id_key" ON "contract_health_scores"("contract_id");

-- CreateIndex
CREATE INDEX "contract_health_scores_tenant_id_idx" ON "contract_health_scores"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_health_scores_overall_score_idx" ON "contract_health_scores"("overall_score" DESC);

-- CreateIndex
CREATE INDEX "contract_health_scores_alert_level_idx" ON "contract_health_scores"("alert_level");

-- CreateIndex
CREATE INDEX "contract_health_scores_calculated_at_idx" ON "contract_health_scores"("calculated_at");

-- CreateIndex
CREATE INDEX "contract_health_scores_tenant_id_overall_score_idx" ON "contract_health_scores"("tenant_id", "overall_score" DESC);

-- CreateIndex
CREATE INDEX "contract_health_scores_tenant_id_alert_level_idx" ON "contract_health_scores"("tenant_id", "alert_level");

-- CreateIndex
CREATE INDEX "contract_health_scores_trend_direction_idx" ON "contract_health_scores"("trend_direction");

-- CreateIndex
CREATE INDEX "contract_health_scores_risk_score_idx" ON "contract_health_scores"("risk_score" DESC);

-- CreateIndex
CREATE INDEX "contract_health_scores_renewal_readiness_idx" ON "contract_health_scores"("renewal_readiness" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "contract_expirations_contract_id_key" ON "contract_expirations"("contract_id");

-- CreateIndex
CREATE INDEX "contract_expirations_tenant_id_idx" ON "contract_expirations"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_expirations_expiration_date_idx" ON "contract_expirations"("expiration_date");

-- CreateIndex
CREATE INDEX "contract_expirations_days_until_expiry_idx" ON "contract_expirations"("days_until_expiry");

-- CreateIndex
CREATE INDEX "contract_expirations_is_expired_idx" ON "contract_expirations"("is_expired");

-- CreateIndex
CREATE INDEX "contract_expirations_expiration_risk_idx" ON "contract_expirations"("expiration_risk");

-- CreateIndex
CREATE INDEX "contract_expirations_renewal_status_idx" ON "contract_expirations"("renewal_status");

-- CreateIndex
CREATE INDEX "contract_expirations_owner_id_idx" ON "contract_expirations"("owner_id");

-- CreateIndex
CREATE INDEX "contract_expirations_assigned_to_idx" ON "contract_expirations"("assigned_to");

-- CreateIndex
CREATE INDEX "contract_expirations_resolution_idx" ON "contract_expirations"("resolution");

-- CreateIndex
CREATE INDEX "contract_expirations_tenant_id_is_expired_idx" ON "contract_expirations"("tenant_id", "is_expired");

-- CreateIndex
CREATE INDEX "contract_expirations_tenant_id_expiration_risk_idx" ON "contract_expirations"("tenant_id", "expiration_risk");

-- CreateIndex
CREATE INDEX "contract_expirations_tenant_id_renewal_status_idx" ON "contract_expirations"("tenant_id", "renewal_status");

-- CreateIndex
CREATE INDEX "contract_expirations_tenant_id_days_until_expiry_idx" ON "contract_expirations"("tenant_id", "days_until_expiry");

-- CreateIndex
CREATE INDEX "contract_expirations_tenant_id_expiration_date_idx" ON "contract_expirations"("tenant_id", "expiration_date");

-- CreateIndex
CREATE INDEX "contract_expirations_notice_period_days_idx" ON "contract_expirations"("notice_period_days");

-- CreateIndex
CREATE INDEX "contract_expirations_notice_deadline_idx" ON "contract_expirations"("notice_deadline");

-- CreateIndex
CREATE INDEX "contract_expirations_next_alert_due_idx" ON "contract_expirations"("next_alert_due");

-- CreateIndex
CREATE INDEX "contract_expirations_value_at_risk_idx" ON "contract_expirations"("value_at_risk" DESC);

-- CreateIndex
CREATE INDEX "expiration_alerts_contract_id_idx" ON "expiration_alerts"("contract_id");

-- CreateIndex
CREATE INDEX "expiration_alerts_tenant_id_idx" ON "expiration_alerts"("tenant_id");

-- CreateIndex
CREATE INDEX "expiration_alerts_alert_type_idx" ON "expiration_alerts"("alert_type");

-- CreateIndex
CREATE INDEX "expiration_alerts_severity_idx" ON "expiration_alerts"("severity");

-- CreateIndex
CREATE INDEX "expiration_alerts_status_idx" ON "expiration_alerts"("status");

-- CreateIndex
CREATE INDEX "expiration_alerts_scheduled_for_idx" ON "expiration_alerts"("scheduled_for");

-- CreateIndex
CREATE INDEX "expiration_alerts_tenant_id_status_idx" ON "expiration_alerts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "expiration_alerts_tenant_id_alert_type_idx" ON "expiration_alerts"("tenant_id", "alert_type");

-- CreateIndex
CREATE INDEX "expiration_alerts_acknowledged_at_idx" ON "expiration_alerts"("acknowledged_at");

-- CreateIndex
CREATE INDEX "renewal_history_contract_id_idx" ON "renewal_history"("contract_id");

-- CreateIndex
CREATE INDEX "renewal_history_tenant_id_idx" ON "renewal_history"("tenant_id");

-- CreateIndex
CREATE INDEX "renewal_history_renewal_type_idx" ON "renewal_history"("renewal_type");

-- CreateIndex
CREATE INDEX "renewal_history_completed_at_idx" ON "renewal_history"("completed_at");

-- CreateIndex
CREATE INDEX "renewal_history_tenant_id_contract_id_idx" ON "renewal_history"("tenant_id", "contract_id");

-- CreateIndex
CREATE INDEX "renewal_history_value_change_idx" ON "renewal_history"("value_change" DESC);

-- CreateIndex
CREATE INDEX "Artifact_generationVersion_idx" ON "Artifact"("generationVersion");

-- CreateIndex
CREATE INDEX "Artifact_qualityScore_idx" ON "Artifact"("qualityScore" DESC);

-- CreateIndex
CREATE INDEX "Artifact_userRating_idx" ON "Artifact"("userRating" DESC);

-- CreateIndex
CREATE INDEX "Artifact_isUserVerified_idx" ON "Artifact"("isUserVerified");

-- CreateIndex
CREATE INDEX "Artifact_modelUsed_idx" ON "Artifact"("modelUsed");

-- CreateIndex
CREATE INDEX "Artifact_tenantId_qualityScore_idx" ON "Artifact"("tenantId", "qualityScore" DESC);

-- CreateIndex
CREATE INDEX "Artifact_tenantId_isUserVerified_idx" ON "Artifact"("tenantId", "isUserVerified");

-- CreateIndex
CREATE INDEX "Contract_renewalStatus_idx" ON "Contract"("renewalStatus");

-- CreateIndex
CREATE INDEX "Contract_tenantId_renewalStatus_idx" ON "Contract"("tenantId", "renewalStatus");

-- CreateIndex
CREATE INDEX "Contract_tenantId_isExpired_idx" ON "Contract"("tenantId", "isExpired");

-- CreateIndex
CREATE INDEX "Contract_tenantId_expirationRisk_idx" ON "Contract"("tenantId", "expirationRisk");

-- CreateIndex
CREATE INDEX "Contract_tenantId_daysUntilExpiry_idx" ON "Contract"("tenantId", "daysUntilExpiry");

-- CreateIndex
CREATE INDEX "Contract_autoRenewalEnabled_idx" ON "Contract"("autoRenewalEnabled");

-- CreateIndex
CREATE INDEX "Contract_renewalInitiatedAt_idx" ON "Contract"("renewalInitiatedAt");

-- CreateIndex
CREATE INDEX "Contract_importSource_idx" ON "Contract"("importSource");

-- CreateIndex
CREATE INDEX "Contract_externalId_idx" ON "Contract"("externalId");

-- CreateIndex
CREATE INDEX "contract_metadata_renewalPriority_idx" ON "contract_metadata"("renewalPriority");

-- CreateIndex
CREATE INDEX "contract_metadata_renewalOwner_idx" ON "contract_metadata"("renewalOwner");

-- CreateIndex
CREATE INDEX "contract_metadata_renewalDeadline_idx" ON "contract_metadata"("renewalDeadline");

-- CreateIndex
CREATE INDEX "contract_metadata_negotiationStatus_idx" ON "contract_metadata"("negotiationStatus");

-- CreateIndex
CREATE INDEX "contract_metadata_performanceScore_idx" ON "contract_metadata"("performanceScore" DESC);

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_renewalPriority_idx" ON "contract_metadata"("tenantId", "renewalPriority");

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_negotiationStatus_idx" ON "contract_metadata"("tenantId", "negotiationStatus");

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_performanceScore_idx" ON "contract_metadata"("tenantId", "performanceScore" DESC);

-- CreateIndex
CREATE INDEX "contract_metadata_lastAiAnalysis_idx" ON "contract_metadata"("lastAiAnalysis");

-- CreateIndex
CREATE INDEX "contract_metadata_expirationHandled_idx" ON "contract_metadata"("expirationHandled");

-- CreateIndex
CREATE INDEX "contract_metadata_archivedAt_idx" ON "contract_metadata"("archivedAt");
