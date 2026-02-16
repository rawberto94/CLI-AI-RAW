/**
 * Amendment Workflow Service
 * Full amendment lifecycle: initiate → draft → review → approve → execute
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AmendmentInput {
  tenantId: string;
  originalContractId: string;
  title: string;
  description?: string;
  amendmentType?: string;
  changesSummary?: object[];
  effectiveDate?: Date;
  financialImpact?: number;
  currency?: string;
  requiresReSignature?: boolean;
  initiatedBy: string;
}

export class AmendmentService {
  static async create(input: AmendmentInput) {
    // Get next amendment number
    const countResult = await prisma.$queryRaw`SELECT COUNT(*)::int + 1 as next_number FROM amendments WHERE tenant_id = ${input.tenantId} AND original_contract_id = ${input.originalContractId}`;
    const amendmentNumber = (countResult as any[])[0]?.next_number || 1;

    const result = await prisma.$queryRaw`INSERT INTO amendments (id, tenant_id, original_contract_id, amendment_number, title, description, amendment_type, status, changes_summary, effective_date, financial_impact, currency, requires_re_signature, initiated_by)
       VALUES (gen_random_uuid()::text, ${input.tenantId}, ${input.originalContractId}, ${amendmentNumber},
      ${input.title}, ${input.description || null}, ${input.amendmentType || 'MODIFICATION'},
      'DRAFT', ${JSON.stringify(input.changesSummary || [])}, ${input.effectiveDate || null},
      ${input.financialImpact || null}, ${input.currency || 'USD'},
      ${input.requiresReSignature ?? true}, ${input.initiatedBy}) RETURNING *`;
    return (result as any[])[0];
  }

  static async list(tenantId: string, contractId?: string) {
    if (contractId) {
      return prisma.$queryRaw`SELECT * FROM amendments WHERE tenant_id = ${tenantId} AND original_contract_id = ${contractId} ORDER BY amendment_number DESC`;
    }
    return prisma.$queryRaw`SELECT * FROM amendments WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
  }

  static async getById(tenantId: string, id: string) {
    const r = await prisma.$queryRaw`SELECT * FROM amendments WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (r as any[])[0] || null;
  }

  static async updateStatus(tenantId: string, id: string, status: string, userId: string) {
    let extrasSql = Prisma.empty;
    if (status === 'APPROVED') extrasSql = Prisma.sql`, approved_by = ${userId}, approved_at = NOW()`;
    if (status === 'EXECUTED') extrasSql = Prisma.sql`, executed_at = NOW()`;

    const result = await prisma.$queryRaw`UPDATE amendments SET status = ${status}${extrasSql}, updated_at = NOW()
       WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
    return (result as any[])[0] || null;
  }

  static async getMetrics(tenantId: string) {
    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'DRAFT')::int as draft,
        COUNT(*) FILTER(WHERE status = 'IN_REVIEW')::int as in_review,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'EXECUTED')::int as executed,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected,
        SUM(CASE WHEN financial_impact IS NOT NULL THEN financial_impact ELSE 0 END)::decimal(15,2) as total_financial_impact
      FROM amendments WHERE tenant_id = ${tenantId}
    `;
    return (result as any[])[0];
  }
}

export default AmendmentService;
