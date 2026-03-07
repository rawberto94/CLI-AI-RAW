/**
 * Evidence Repository Service
 * Manages compliance evidence linked to obligations
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EvidenceInput {
  tenantId: string;
  obligationId: string;
  contractId: string;
  title: string;
  description?: string;
  evidenceType?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  uploadedBy: string;
}

export class EvidenceService {
  static async create(input: EvidenceInput) {
    const result = await prisma.$queryRaw`INSERT INTO evidence_items (id, tenant_id, obligation_id, contract_id, title, description, evidence_type, file_url, file_name, file_size, mime_type, metadata, tags, uploaded_by)
       VALUES (gen_random_uuid()::text, ${input.tenantId}, ${input.obligationId}, ${input.contractId}, ${input.title},
      ${input.description || null}, ${input.evidenceType || 'DOCUMENT'},
      ${input.fileUrl || null}, ${input.fileName || null}, ${input.fileSize || null},
      ${input.mimeType || null}, ${JSON.stringify(input.metadata || {})},
      ${JSON.stringify(input.tags || [])}, ${input.uploadedBy}) RETURNING *`;
    return (result as any[])[0];
  }

  static async listByObligation(tenantId: string, obligationId: string) {
    return prisma.$queryRaw`SELECT * FROM evidence_items WHERE tenant_id = ${tenantId} AND obligation_id = ${obligationId} ORDER BY created_at DESC`;
  }

  static async listByContract(tenantId: string, contractId: string) {
    return prisma.$queryRaw`SELECT * FROM evidence_items WHERE tenant_id = ${tenantId} AND contract_id = ${contractId} ORDER BY created_at DESC`;
  }

  static async verify(tenantId: string, id: string, verifiedBy: string, notes?: string) {
    const result = await prisma.$queryRaw`UPDATE evidence_items SET status = 'VERIFIED', verified_by = ${verifiedBy}, verified_at = NOW(), verification_notes = ${notes || null}, updated_at = NOW()
       WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
    return (result as any[])[0] || null;
  }

  static async reject(tenantId: string, id: string, verifiedBy: string, notes: string) {
    const result = await prisma.$queryRaw`UPDATE evidence_items SET status = 'REJECTED', verified_by = ${verifiedBy}, verified_at = NOW(), verification_notes = ${notes}, updated_at = NOW()
       WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
    return (result as any[])[0] || null;
  }

  static async getMetrics(tenantId: string, contractId?: string) {
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];
    if (contractId) conditions.push(Prisma.sql`contract_id = ${contractId}`);
    const where = Prisma.join(conditions, ' AND ');

    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'VERIFIED')::int as verified,
        COUNT(*) FILTER(WHERE status = 'PENDING_REVIEW')::int as pending,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected
      FROM evidence_items WHERE ${where}
    `;
    return (result as any[])[0];
  }
}

export default EvidenceService;
