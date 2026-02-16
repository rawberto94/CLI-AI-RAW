/**
 * Vendor Risk Profile Service
 * Manages third-party risk assessments with multi-dimensional scoring
 */

import { Prisma, PrismaClient } from '@prisma/client';

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

    const result = await prisma.$queryRaw`INSERT INTO vendor_risk_profiles (id, tenant_id, vendor_name, vendor_id, risk_tier, overall_score, financial_risk, operational_risk, compliance_risk, cyber_risk, geopolitical_risk, questionnaire_responses, certifications, insurance_details, notes, assessed_by, last_assessment_date, next_assessment_due)
       VALUES (gen_random_uuid()::text, ${input.tenantId}, ${input.vendorName}, ${input.vendorId || null},
      ${riskTier}, ${overallScore},
      ${input.financialRisk || 50}, ${input.operationalRisk || 50},
      ${input.complianceRisk || 50}, ${input.cyberRisk || 50}, ${input.geopoliticalRisk || 50},
      ${JSON.stringify(input.questionnaireResponses || {})},
      ${JSON.stringify(input.certifications || [])},
      ${JSON.stringify(input.insuranceDetails || {})},
      ${input.notes || null}, ${input.assessedBy || null}, NOW(), NOW() + INTERVAL '90 days') RETURNING *`;
    return (result as any[])[0];
  }

  static async list(tenantId: string, filters: { riskTier?: string } = {}) {
    if (filters.riskTier) {
      return prisma.$queryRaw`SELECT * FROM vendor_risk_profiles WHERE tenant_id = ${tenantId} AND risk_tier = ${filters.riskTier} ORDER BY overall_score DESC`;
    }
    return prisma.$queryRaw`SELECT * FROM vendor_risk_profiles WHERE tenant_id = ${tenantId} ORDER BY overall_score DESC`;
  }

  static async getById(tenantId: string, id: string) {
    const r = await prisma.$queryRaw`SELECT * FROM vendor_risk_profiles WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (r as any[])[0] || null;
  }

  static async update(tenantId: string, id: string, data: Partial<VendorRiskInput>) {
    const overallScore = VendorRiskService.calculateOverallScore(data);
    const riskTier = overallScore >= 70 ? 'HIGH' : overallScore >= 40 ? 'MEDIUM' : 'LOW';

    const result = await prisma.$queryRaw`UPDATE vendor_risk_profiles SET
        vendor_name = COALESCE(${data.vendorName || null}, vendor_name), risk_tier = ${riskTier}, overall_score = ${overallScore},
        financial_risk = COALESCE(${data.financialRisk || null}, financial_risk), operational_risk = COALESCE(${data.operationalRisk || null}, operational_risk),
        compliance_risk = COALESCE(${data.complianceRisk || null}, compliance_risk), cyber_risk = COALESCE(${data.cyberRisk || null}, cyber_risk),
        geopolitical_risk = COALESCE(${data.geopoliticalRisk || null}, geopolitical_risk), notes = COALESCE(${data.notes || null}, notes),
        last_assessment_date = NOW(), next_assessment_due = NOW() + INTERVAL '90 days', updated_at = NOW()
       WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
    return (result as any[])[0] || null;
  }

  static async getMetrics(tenantId: string) {
    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE risk_tier = 'HIGH')::int as high_risk,
        COUNT(*) FILTER(WHERE risk_tier = 'MEDIUM')::int as medium_risk,
        COUNT(*) FILTER(WHERE risk_tier = 'LOW')::int as low_risk,
        AVG(overall_score)::int as avg_score,
        COUNT(*) FILTER(WHERE next_assessment_due < NOW())::int as overdue_assessments
      FROM vendor_risk_profiles WHERE tenant_id = ${tenantId}
    `;
    return (result as any[])[0];
  }
}

export default VendorRiskService;
