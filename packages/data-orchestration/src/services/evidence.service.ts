/**
 * Evidence Repository Service
 * Manages compliance evidence linked to obligations
 */

import { PrismaClient } from '@prisma/client';

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
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO evidence_items (id, tenant_id, obligation_id, contract_id, title, description, evidence_type, file_url, file_name, file_size, mime_type, metadata, tags, uploaded_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      input.tenantId, input.obligationId, input.contractId, input.title,
      input.description || null, input.evidenceType || 'DOCUMENT',
      input.fileUrl || null, input.fileName || null, input.fileSize || null,
      input.mimeType || null, JSON.stringify(input.metadata || {}),
      JSON.stringify(input.tags || []), input.uploadedBy
    );
    return (result as any[])[0];
  }

  static async listByObligation(tenantId: string, obligationId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM evidence_items WHERE tenant_id = $1 AND obligation_id = $2 ORDER BY created_at DESC`,
      tenantId, obligationId
    );
  }

  static async listByContract(tenantId: string, contractId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM evidence_items WHERE tenant_id = $1 AND contract_id = $2 ORDER BY created_at DESC`,
      tenantId, contractId
    );
  }

  static async verify(tenantId: string, id: string, verifiedBy: string, notes?: string) {
    const result = await prisma.$queryRawUnsafe(
      `UPDATE evidence_items SET status = 'VERIFIED', verified_by = $1, verified_at = NOW(), verification_notes = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      verifiedBy, notes || null, id, tenantId
    );
    return (result as any[])[0] || null;
  }

  static async reject(tenantId: string, id: string, verifiedBy: string, notes: string) {
    const result = await prisma.$queryRawUnsafe(
      `UPDATE evidence_items SET status = 'REJECTED', verified_by = $1, verified_at = NOW(), verification_notes = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      verifiedBy, notes, id, tenantId
    );
    return (result as any[])[0] || null;
  }

  static async getMetrics(tenantId: string, contractId?: string) {
    const where = contractId
      ? `WHERE tenant_id = $1 AND contract_id = $2`
      : `WHERE tenant_id = $1`;
    const params = contractId ? [tenantId, contractId] : [tenantId];

    const result = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'VERIFIED')::int as verified,
        COUNT(*) FILTER(WHERE status = 'PENDING_REVIEW')::int as pending,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected
      FROM evidence_items ${where}
    `, ...params);
    return (result as any[])[0];
  }
}

export default EvidenceService;
