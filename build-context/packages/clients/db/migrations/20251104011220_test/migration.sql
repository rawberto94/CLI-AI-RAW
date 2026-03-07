/*
  Warnings:

  - You are about to drop the column `actualSavings` on the `rate_savings_opportunities` table. All the data in the column will be lost.
  - You are about to drop the column `annualSavings` on the `rate_savings_opportunities` table. All the data in the column will be lost.
  - Added the required column `marketMedian` to the `benchmark_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rateValue` to the `benchmark_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `annualSavingsPotential` to the `rate_savings_opportunities` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "rate_savings_opportunities_annualSavings_idx";

-- AlterTable
ALTER TABLE "benchmark_snapshots" ADD COLUMN     "marketMedian" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "rateValue" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "rate_card_entries" ADD COLUMN     "baselineType" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "editHistory" JSONB DEFAULT '[]',
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedBy" TEXT,
ADD COLUMN     "isBaseline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEditable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "msaReference" TEXT,
ADD COLUMN     "negotiatedBy" TEXT,
ADD COLUMN     "negotiationDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rate_savings_opportunities" DROP COLUMN "actualSavings",
DROP COLUMN "annualSavings",
ADD COLUMN     "actualSavingsRealized" DECIMAL(15,2),
ADD COLUMN     "annualSavingsPotential" DECIMAL(15,2) NOT NULL;

-- CreateTable
CREATE TABLE "supplier_scores" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "overallScore" DECIMAL(5,2) NOT NULL,
    "priceCompetitiveness" DECIMAL(5,2) NOT NULL,
    "geographicCoverage" DECIMAL(5,2) NOT NULL,
    "rateStability" DECIMAL(5,2) NOT NULL,
    "growthTrajectory" DECIMAL(5,2) NOT NULL,
    "ranking" INTEGER NOT NULL,
    "totalSuppliers" INTEGER NOT NULL,
    "trend" TEXT NOT NULL,
    "previousScore" DECIMAL(5,2),
    "scoreChange" DECIMAL(5,2),
    "calculationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPointsUsed" INTEGER NOT NULL,
    "confidenceLevel" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_taxonomy" (
    "id" TEXT NOT NULL,
    "standardized_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industry" TEXT,
    "line_of_service" TEXT,
    "seniority_level" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_mappings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "original_role" TEXT NOT NULL,
    "standardized_role" TEXT NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.70,
    "source" TEXT NOT NULL,
    "user_id" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_forecasts" (
    "id" TEXT NOT NULL,
    "rate_card_entry_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "current_rate" DECIMAL(10,2) NOT NULL,
    "forecast_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "three_month_rate" DECIMAL(10,2) NOT NULL,
    "three_month_confidence" DECIMAL(5,2) NOT NULL,
    "three_month_lower" DECIMAL(10,2) NOT NULL,
    "three_month_upper" DECIMAL(10,2) NOT NULL,
    "six_month_rate" DECIMAL(10,2) NOT NULL,
    "six_month_confidence" DECIMAL(5,2) NOT NULL,
    "six_month_lower" DECIMAL(10,2) NOT NULL,
    "six_month_upper" DECIMAL(10,2) NOT NULL,
    "twelve_month_rate" DECIMAL(10,2) NOT NULL,
    "twelve_month_confidence" DECIMAL(5,2) NOT NULL,
    "twelve_month_lower" DECIMAL(10,2) NOT NULL,
    "twelve_month_upper" DECIMAL(10,2) NOT NULL,
    "trend_direction" TEXT NOT NULL,
    "trend_coefficient" DECIMAL(10,6) NOT NULL,
    "risk_level" TEXT NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "historical_data_points" INTEGER NOT NULL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlier_flags" (
    "id" TEXT NOT NULL,
    "rate_card_entry_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "outlier_type" TEXT NOT NULL,
    "deviation_sigma" DECIMAL(10,4) NOT NULL,
    "market_mean" DECIMAL(10,2) NOT NULL,
    "market_median" DECIMAL(10,2) NOT NULL,
    "standard_deviation" DECIMAL(10,2) NOT NULL,
    "severity" TEXT NOT NULL,
    "review_status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_action" TEXT,
    "review_notes" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outlier_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlier_review_actions" (
    "id" TEXT NOT NULL,
    "rate_card_entry_id" TEXT NOT NULL,
    "outlier_flag_id" TEXT,
    "reviewed_by" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "outlier_review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_resolutions" (
    "id" TEXT NOT NULL,
    "duplicate_group_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resolved_by" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "merged_into_id" TEXT,
    "deleted_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "duplicate_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_clusters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cluster_type" TEXT NOT NULL DEFAULT 'K_MEANS',
    "member_count" INTEGER NOT NULL,
    "avg_rate" DECIMAL(10,2) NOT NULL,
    "min_rate" DECIMAL(10,2) NOT NULL,
    "max_rate" DECIMAL(10,2) NOT NULL,
    "characteristics" JSONB NOT NULL,
    "centroid" JSONB NOT NULL,
    "consolidation_savings" DECIMAL(15,2) NOT NULL,
    "supplier_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_card_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster_members" (
    "id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "rate_card_entry_id" TEXT NOT NULL,
    "similarity_score" DECIMAL(5,2) NOT NULL,
    "distance_to_centroid" DECIMAL(10,6) NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cluster_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consolidation_opportunities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "opportunity_name" TEXT NOT NULL,
    "description" TEXT,
    "current_supplier_count" INTEGER NOT NULL,
    "recommended_supplier_id" TEXT NOT NULL,
    "recommended_supplier_name" TEXT NOT NULL,
    "suppliers_to_consolidate" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_annual_cost" DECIMAL(15,2) NOT NULL,
    "projected_annual_cost" DECIMAL(15,2) NOT NULL,
    "annual_savings" DECIMAL(15,2) NOT NULL,
    "annual_savings_potential" DECIMAL(15,2) NOT NULL,
    "savings_percentage" DECIMAL(5,2) NOT NULL,
    "total_volume" INTEGER NOT NULL,
    "volume_by_supplier" JSONB NOT NULL,
    "risk_level" TEXT NOT NULL,
    "risk_factors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "implementation_complexity" TEXT NOT NULL,
    "estimated_timeframe" TEXT NOT NULL,
    "action_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DECIMAL(5,2) NOT NULL,
    "data_quality" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "assigned_to" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "implemented_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consolidation_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geographic_arbitrage_opportunities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cluster_id" TEXT NOT NULL,
    "source_country" TEXT NOT NULL,
    "source_region" TEXT NOT NULL,
    "target_country" TEXT NOT NULL,
    "target_region" TEXT NOT NULL,
    "current_average_rate" DECIMAL(10,2) NOT NULL,
    "target_average_rate" DECIMAL(10,2) NOT NULL,
    "rate_difference" DECIMAL(10,2) NOT NULL,
    "savings_percentage" DECIMAL(5,2) NOT NULL,
    "annual_savings_potential" DECIMAL(15,2) NOT NULL,
    "affected_roles" INTEGER NOT NULL,
    "estimated_ftes" INTEGER NOT NULL,
    "quality_difference" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL,
    "risk_factors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feasibility" TEXT NOT NULL,
    "considerations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DECIMAL(5,2) NOT NULL,
    "source_sample_size" INTEGER NOT NULL,
    "target_sample_size" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFIED',
    "assigned_to" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "implemented_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geographic_arbitrage_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_segments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_card_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_alerts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_card_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "recipients" JSONB NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "last_run" TIMESTAMP(3),
    "next_run" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'exchangerate-api.io',

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_volatility_alerts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL,
    "change_percent" DECIMAL(5,2) NOT NULL,
    "previous_rate" DECIMAL(10,6) NOT NULL,
    "current_rate" DECIMAL(10,6) NOT NULL,
    "affected_rates" INTEGER NOT NULL DEFAULT 0,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_volatility_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_scenarios" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_rate" DECIMAL(10,2) NOT NULL,
    "current_rate" DECIMAL(10,2) NOT NULL,
    "savings" DECIMAL(15,2) NOT NULL,
    "savings_percentage" DECIMAL(5,2) NOT NULL,
    "annual_volume" INTEGER NOT NULL,
    "annual_cost" DECIMAL(15,2) NOT NULL,
    "rate_card_id" TEXT,
    "supplier_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_scores_supplierId_calculationDate_idx" ON "supplier_scores"("supplierId", "calculationDate");

-- CreateIndex
CREATE INDEX "supplier_scores_tenantId_overallScore_idx" ON "supplier_scores"("tenantId", "overallScore");

-- CreateIndex
CREATE INDEX "supplier_scores_tenantId_calculationDate_idx" ON "supplier_scores"("tenantId", "calculationDate");

-- CreateIndex
CREATE INDEX "supplier_scores_ranking_idx" ON "supplier_scores"("ranking");

-- CreateIndex
CREATE UNIQUE INDEX "role_taxonomy_standardized_name_key" ON "role_taxonomy"("standardized_name");

-- CreateIndex
CREATE INDEX "role_taxonomy_category_idx" ON "role_taxonomy"("category");

-- CreateIndex
CREATE INDEX "role_taxonomy_usage_count_idx" ON "role_taxonomy"("usage_count" DESC);

-- CreateIndex
CREATE INDEX "role_taxonomy_standardized_name_idx" ON "role_taxonomy"("standardized_name");

-- CreateIndex
CREATE INDEX "role_mappings_tenant_id_idx" ON "role_mappings"("tenant_id");

-- CreateIndex
CREATE INDEX "role_mappings_original_role_idx" ON "role_mappings"("original_role");

-- CreateIndex
CREATE INDEX "role_mappings_standardized_role_idx" ON "role_mappings"("standardized_role");

-- CreateIndex
CREATE INDEX "role_mappings_source_idx" ON "role_mappings"("source");

-- CreateIndex
CREATE INDEX "role_mappings_tenant_id_original_role_idx" ON "role_mappings"("tenant_id", "original_role");

-- CreateIndex
CREATE INDEX "rate_forecasts_rate_card_entry_id_idx" ON "rate_forecasts"("rate_card_entry_id");

-- CreateIndex
CREATE INDEX "rate_forecasts_tenant_id_forecast_date_idx" ON "rate_forecasts"("tenant_id", "forecast_date");

-- CreateIndex
CREATE INDEX "rate_forecasts_risk_level_idx" ON "rate_forecasts"("risk_level");

-- CreateIndex
CREATE INDEX "rate_forecasts_trend_direction_idx" ON "rate_forecasts"("trend_direction");

-- CreateIndex
CREATE UNIQUE INDEX "outlier_flags_rate_card_entry_id_key" ON "outlier_flags"("rate_card_entry_id");

-- CreateIndex
CREATE INDEX "outlier_flags_tenant_id_idx" ON "outlier_flags"("tenant_id");

-- CreateIndex
CREATE INDEX "outlier_flags_review_status_idx" ON "outlier_flags"("review_status");

-- CreateIndex
CREATE INDEX "outlier_flags_severity_idx" ON "outlier_flags"("severity");

-- CreateIndex
CREATE INDEX "outlier_flags_deviation_sigma_idx" ON "outlier_flags"("deviation_sigma" DESC);

-- CreateIndex
CREATE INDEX "outlier_flags_tenant_id_review_status_idx" ON "outlier_flags"("tenant_id", "review_status");

-- CreateIndex
CREATE INDEX "outlier_review_actions_rate_card_entry_id_idx" ON "outlier_review_actions"("rate_card_entry_id");

-- CreateIndex
CREATE INDEX "outlier_review_actions_outlier_flag_id_idx" ON "outlier_review_actions"("outlier_flag_id");

-- CreateIndex
CREATE INDEX "outlier_review_actions_reviewed_at_idx" ON "outlier_review_actions"("reviewed_at");

-- CreateIndex
CREATE INDEX "duplicate_resolutions_duplicate_group_id_idx" ON "duplicate_resolutions"("duplicate_group_id");

-- CreateIndex
CREATE INDEX "duplicate_resolutions_resolved_at_idx" ON "duplicate_resolutions"("resolved_at");

-- CreateIndex
CREATE INDEX "rate_card_clusters_tenant_id_idx" ON "rate_card_clusters"("tenant_id");

-- CreateIndex
CREATE INDEX "rate_card_clusters_consolidation_savings_idx" ON "rate_card_clusters"("consolidation_savings" DESC);

-- CreateIndex
CREATE INDEX "rate_card_clusters_created_at_idx" ON "rate_card_clusters"("created_at");

-- CreateIndex
CREATE INDEX "cluster_members_cluster_id_idx" ON "cluster_members"("cluster_id");

-- CreateIndex
CREATE INDEX "cluster_members_rate_card_entry_id_idx" ON "cluster_members"("rate_card_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "cluster_members_cluster_id_rate_card_entry_id_key" ON "cluster_members"("cluster_id", "rate_card_entry_id");

-- CreateIndex
CREATE INDEX "consolidation_opportunities_tenant_id_idx" ON "consolidation_opportunities"("tenant_id");

-- CreateIndex
CREATE INDEX "consolidation_opportunities_cluster_id_idx" ON "consolidation_opportunities"("cluster_id");

-- CreateIndex
CREATE INDEX "consolidation_opportunities_status_idx" ON "consolidation_opportunities"("status");

-- CreateIndex
CREATE INDEX "consolidation_opportunities_annual_savings_idx" ON "consolidation_opportunities"("annual_savings" DESC);

-- CreateIndex
CREATE INDEX "consolidation_opportunities_tenant_id_status_idx" ON "consolidation_opportunities"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "geographic_arbitrage_opportunities_tenant_id_idx" ON "geographic_arbitrage_opportunities"("tenant_id");

-- CreateIndex
CREATE INDEX "geographic_arbitrage_opportunities_cluster_id_idx" ON "geographic_arbitrage_opportunities"("cluster_id");

-- CreateIndex
CREATE INDEX "geographic_arbitrage_opportunities_status_idx" ON "geographic_arbitrage_opportunities"("status");

-- CreateIndex
CREATE INDEX "geographic_arbitrage_opportunities_annual_savings_potential_idx" ON "geographic_arbitrage_opportunities"("annual_savings_potential" DESC);

-- CreateIndex
CREATE INDEX "geographic_arbitrage_opportunities_source_country_idx" ON "geographic_arbitrage_opportunities"("source_country");

-- CreateIndex
CREATE INDEX "geographic_arbitrage_opportunities_target_country_idx" ON "geographic_arbitrage_opportunities"("target_country");

-- CreateIndex
CREATE INDEX "geographic_arbitrage_opportunities_tenant_id_status_idx" ON "geographic_arbitrage_opportunities"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "rate_card_segments_tenant_id_idx" ON "rate_card_segments"("tenant_id");

-- CreateIndex
CREATE INDEX "rate_card_segments_user_id_idx" ON "rate_card_segments"("user_id");

-- CreateIndex
CREATE INDEX "rate_card_segments_tenant_id_shared_idx" ON "rate_card_segments"("tenant_id", "shared");

-- CreateIndex
CREATE INDEX "rate_card_segments_usage_count_idx" ON "rate_card_segments"("usage_count" DESC);

-- CreateIndex
CREATE INDEX "rate_card_alerts_tenant_id_read_created_at_idx" ON "rate_card_alerts"("tenant_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "rate_card_alerts_user_id_read_idx" ON "rate_card_alerts"("user_id", "read");

-- CreateIndex
CREATE INDEX "rate_card_alerts_type_idx" ON "rate_card_alerts"("type");

-- CreateIndex
CREATE INDEX "rate_card_alerts_severity_idx" ON "rate_card_alerts"("severity");

-- CreateIndex
CREATE INDEX "rate_card_alerts_tenant_id_type_read_idx" ON "rate_card_alerts"("tenant_id", "type", "read");

-- CreateIndex
CREATE INDEX "scheduled_reports_tenant_id_enabled_next_run_idx" ON "scheduled_reports"("tenant_id", "enabled", "next_run");

-- CreateIndex
CREATE INDEX "scheduled_reports_user_id_idx" ON "scheduled_reports"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_reports_type_idx" ON "scheduled_reports"("type");

-- CreateIndex
CREATE INDEX "scheduled_reports_next_run_idx" ON "scheduled_reports"("next_run");

-- CreateIndex
CREATE INDEX "exchange_rates_from_currency_to_currency_timestamp_idx" ON "exchange_rates"("from_currency", "to_currency", "timestamp");

-- CreateIndex
CREATE INDEX "exchange_rates_timestamp_idx" ON "exchange_rates"("timestamp");

-- CreateIndex
CREATE INDEX "currency_volatility_alerts_tenant_id_acknowledged_idx" ON "currency_volatility_alerts"("tenant_id", "acknowledged");

-- CreateIndex
CREATE INDEX "currency_volatility_alerts_currency_idx" ON "currency_volatility_alerts"("currency");

-- CreateIndex
CREATE INDEX "currency_volatility_alerts_detected_at_idx" ON "currency_volatility_alerts"("detected_at");

-- CreateIndex
CREATE INDEX "currency_volatility_alerts_change_percent_idx" ON "currency_volatility_alerts"("change_percent" DESC);

-- CreateIndex
CREATE INDEX "negotiation_scenarios_tenant_id_idx" ON "negotiation_scenarios"("tenant_id");

-- CreateIndex
CREATE INDEX "negotiation_scenarios_status_idx" ON "negotiation_scenarios"("status");

-- CreateIndex
CREATE INDEX "negotiation_scenarios_rate_card_id_idx" ON "negotiation_scenarios"("rate_card_id");

-- CreateIndex
CREATE INDEX "rate_card_entries_clientName_idx" ON "rate_card_entries"("clientName");

-- CreateIndex
CREATE INDEX "rate_card_entries_clientId_idx" ON "rate_card_entries"("clientId");

-- CreateIndex
CREATE INDEX "rate_card_entries_isBaseline_idx" ON "rate_card_entries"("isBaseline");

-- CreateIndex
CREATE INDEX "rate_card_entries_isNegotiated_idx" ON "rate_card_entries"("isNegotiated");

-- CreateIndex
CREATE INDEX "rate_card_entries_tenantId_clientName_idx" ON "rate_card_entries"("tenantId", "clientName");

-- CreateIndex
CREATE INDEX "rate_card_entries_isBaseline_isNegotiated_idx" ON "rate_card_entries"("isBaseline", "isNegotiated");

-- CreateIndex
CREATE INDEX "rate_card_entries_tenantId_clientName_isBaseline_isNegotiat_idx" ON "rate_card_entries"("tenantId", "clientName", "isBaseline", "isNegotiated");

-- CreateIndex
CREATE INDEX "rate_savings_opportunities_annualSavingsPotential_idx" ON "rate_savings_opportunities"("annualSavingsPotential" DESC);

-- AddForeignKey
ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "rate_card_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_forecasts" ADD CONSTRAINT "rate_forecasts_rate_card_entry_id_fkey" FOREIGN KEY ("rate_card_entry_id") REFERENCES "rate_card_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlier_flags" ADD CONSTRAINT "outlier_flags_rate_card_entry_id_fkey" FOREIGN KEY ("rate_card_entry_id") REFERENCES "rate_card_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlier_review_actions" ADD CONSTRAINT "outlier_review_actions_outlier_flag_id_fkey" FOREIGN KEY ("outlier_flag_id") REFERENCES "outlier_flags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "rate_card_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_segments" ADD CONSTRAINT "rate_card_segments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
