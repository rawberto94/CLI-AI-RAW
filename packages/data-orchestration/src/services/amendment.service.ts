/**
 * Amendment Workflow Service
 * Full amendment lifecycle: initiate → draft → review → approve → execute
 */

import { PrismaClient } from '@prisma/client';

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
    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int + 1 as next_number FROM amendments WHERE tenant_id = $1 AND original_contract_id = $2`,
      input.tenantId, input.originalContractId
    );
    const amendmentNumber = (countResult as any[])[0]?.next_number || 1;

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO amendments (id, tenant_id, original_contract_id, amendment_number, title, description, amendment_type, status, changes_summary, effective_date, financial_impact, currency, requires_re_signature, initiated_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8, $9, $10, $11, $12) RETURNING *`,
      input.tenantId, input.originalContractId, amendmentNumber,
      input.title, input.description || null, input.amendmentType || 'MODIFICATION',
      JSON.stringify(input.changesSummary || []), input.effectiveDate || null,
      input.financialImpact || null, input.currency || 'USD',
      input.requiresReSignature ?? true, input.initiatedBy
    );
    return (result as any[])[0];
  }

  static async list(tenantId: string, contractId?: string) {
    if (contractId) {
      return prisma.$queryRawUnsafe(
        `SELECT * FROM amendments WHERE tenant_id = $1 AND original_contract_id = $2 ORDER BY amendment_number DESC`,
        tenantId, contractId
      );
    }
    return prisma.$queryRawUnsafe(
      `SELECT * FROM amendments WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantId
    );
  }

  static async getById(tenantId: string, id: string) {
    const r = await prisma.$queryRawUnsafe(
      `SELECT * FROM amendments WHERE id = $1 AND tenant_id = $2`, id, tenantId
    );
    return (r as any[])[0] || null;
  }

  static async updateStatus(tenantId: string, id: string, status: string, userId: string) {
    const extras: string[] = [];
    if (status === 'APPROVED') extras.push(`approved_by = '${userId}', approved_at = NOW()`);
    if (status === 'EXECUTED') extras.push(`executed_at = NOW()`);

    const result = await prisma.$queryRawUnsafe(
      `UPDATE amendments SET status = $1 ${extras.length ? ', ' + extras.join(', ') : ''}, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      status, id, tenantId
    );
    return (result as any[])[0] || null;
  }

  static async getMetrics(tenantId: string) {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'DRAFT')::int as draft,
        COUNT(*) FILTER(WHERE status = 'IN_REVIEW')::int as in_review,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'EXECUTED')::int as executed,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected,
        SUM(CASE WHEN financial_impact IS NOT NULL THEN financial_impact ELSE 0 END)::decimal(15,2) as total_financial_impact
      FROM amendments WHERE tenant_id = $1
    `, tenantId);
    return (result as any[])[0];
  }
}

export default AmendmentService;
