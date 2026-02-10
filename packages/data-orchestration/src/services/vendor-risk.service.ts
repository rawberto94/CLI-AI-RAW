/**
 * Vendor Risk Profile Service
 * Manages third-party risk assessments with multi-dimensional scoring
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface VendorRiskInput {
  tenantId: string;
  vendorName: string;
  vendorId?: string;
  riskTier?: string;
  financialRisk?: number;
  operationalRisk?: number;
  complianceRisk?: number;
  cyberRisk?: number;
  geopoliticalRisk?: number;
  questionnaireResponses?: Record<string, unknown>;
  certifications?: object[];
  insuranceDetails?: Record<string, unknown>;
  notes?: string;
  assessedBy?: string;
}

export class VendorRiskService {
  static calculateOverallScore(input: Partial<VendorRiskInput>): number {
    const weights = { financial: 0.25, operational: 0.25, compliance: 0.2, cyber: 0.2, geopolitical: 0.1 };
    return Math.round(
      (input.financialRisk || 50) * weights.financial +
      (input.operationalRisk || 50) * weights.operational +
      (input.complianceRisk || 50) * weights.compliance +
      (input.cyberRisk || 50) * weights.cyber +
      (input.geopoliticalRisk || 50) * weights.geopolitical
    );
  }

  static async create(input: VendorRiskInput) {
    const overallScore = VendorRiskService.calculateOverallScore(input);
    const riskTier = overallScore >= 70 ? 'HIGH' : overallScore >= 40 ? 'MEDIUM' : 'LOW';

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO vendor_risk_profiles (id, tenant_id, vendor_name, vendor_id, risk_tier, overall_score, financial_risk, operational_risk, compliance_risk, cyber_risk, geopolitical_risk, questionnaire_responses, certifications, insurance_details, notes, assessed_by, last_assessment_date, next_assessment_due)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW() + INTERVAL '90 days') RETURNING *`,
      input.tenantId, input.vendorName, input.vendorId || null,
      riskTier, overallScore,
      input.financialRisk || 50, input.operationalRisk || 50,
      input.complianceRisk || 50, input.cyberRisk || 50, input.geopoliticalRisk || 50,
      JSON.stringify(input.questionnaireResponses || {}),
      JSON.stringify(input.certifications || []),
      JSON.stringify(input.insuranceDetails || {}),
      input.notes || null, input.assessedBy || null
    );
    return (result as any[])[0];
  }

  static async list(tenantId: string, filters: { riskTier?: string } = {}) {
    if (filters.riskTier) {
      return prisma.$queryRawUnsafe(
        `SELECT * FROM vendor_risk_profiles WHERE tenant_id = $1 AND risk_tier = $2 ORDER BY overall_score DESC`,
        tenantId, filters.riskTier
      );
    }
    return prisma.$queryRawUnsafe(
      `SELECT * FROM vendor_risk_profiles WHERE tenant_id = $1 ORDER BY overall_score DESC`, tenantId
    );
  }

  static async getById(tenantId: string, id: string) {
    const r = await prisma.$queryRawUnsafe(
      `SELECT * FROM vendor_risk_profiles WHERE id = $1 AND tenant_id = $2`, id, tenantId
    );
    return (r as any[])[0] || null;
  }

  static async update(tenantId: string, id: string, data: Partial<VendorRiskInput>) {
    const overallScore = VendorRiskService.calculateOverallScore(data);
    const riskTier = overallScore >= 70 ? 'HIGH' : overallScore >= 40 ? 'MEDIUM' : 'LOW';

    const result = await prisma.$queryRawUnsafe(
      `UPDATE vendor_risk_profiles SET
        vendor_name = COALESCE($1, vendor_name), risk_tier = $2, overall_score = $3,
        financial_risk = COALESCE($4, financial_risk), operational_risk = COALESCE($5, operational_risk),
        compliance_risk = COALESCE($6, compliance_risk), cyber_risk = COALESCE($7, cyber_risk),
        geopolitical_risk = COALESCE($8, geopolitical_risk), notes = COALESCE($9, notes),
        last_assessment_date = NOW(), next_assessment_due = NOW() + INTERVAL '90 days', updated_at = NOW()
       WHERE id = $10 AND tenant_id = $11 RETURNING *`,
      data.vendorName || null, riskTier, overallScore,
      data.financialRisk || null, data.operationalRisk || null,
      data.complianceRisk || null, data.cyberRisk || null,
      data.geopoliticalRisk || null, data.notes || null,
      id, tenantId
    );
    return (result as any[])[0] || null;
  }

  static async getMetrics(tenantId: string) {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE risk_tier = 'HIGH')::int as high_risk,
        COUNT(*) FILTER(WHERE risk_tier = 'MEDIUM')::int as medium_risk,
        COUNT(*) FILTER(WHERE risk_tier = 'LOW')::int as low_risk,
        AVG(overall_score)::int as avg_score,
        COUNT(*) FILTER(WHERE next_assessment_due < NOW())::int as overdue_assessments
      FROM vendor_risk_profiles WHERE tenant_id = $1
    `, tenantId);
    return (result as any[])[0];
  }
}

export default VendorRiskService;
