/**
 * Document Expiry Monitoring Service
 * Tracks expiration of vendor certifications, insurance, and compliance documents
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DocumentExpiryService {
  static async create(tenantId: string, data: any) {
    const result = await prisma.$queryRaw`INSERT INTO document_expiry_items (id, tenant_id, vendor_name, vendor_id, document_type, document_name, file_url, issue_date, expiry_date, alert_days_before, auto_notify, notify_emails, created_by)
       VALUES (gen_random_uuid()::text, ${tenantId}, ${data.vendorName}, ${data.vendorId || null}, ${data.documentType},
      ${data.documentName}, ${data.fileUrl || null}, ${data.issueDate || null},
      ${data.expiryDate}, ${JSON.stringify(data.alertDaysBefore || [90, 60, 30, 14])},
      ${data.autoNotify ?? true}, ${JSON.stringify(data.notifyEmails || [])}, ${data.createdBy}) RETURNING *`;
    return (result as any[])[0];
  }

  static async list(tenantId: string, filters: { status?: string; vendorName?: string } = {}) {
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];
    if (filters.status) conditions.push(Prisma.sql`status = ${filters.status}`);
    if (filters.vendorName) conditions.push(Prisma.sql`vendor_name ILIKE ${'%' + filters.vendorName + '%'}`);
    const where = Prisma.join(conditions, ' AND ');
    return prisma.$queryRaw`SELECT *, CASE WHEN expiry_date < NOW() THEN 'EXPIRED' WHEN expiry_date < NOW() + INTERVAL '30 days' THEN 'EXPIRING_SOON' ELSE status END as computed_status FROM document_expiry_items WHERE ${where} ORDER BY expiry_date ASC`;
  }

  static async getExpiringSoon(tenantId: string, days: number = 30) {
    return prisma.$queryRaw`SELECT * FROM document_expiry_items WHERE tenant_id = ${tenantId} AND status = 'ACTIVE' AND expiry_date BETWEEN NOW() AND NOW() + ${days} * INTERVAL '1 day' ORDER BY expiry_date ASC`;
  }

  static async getMetrics(tenantId: string) {
    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE expiry_date < NOW())::int as expired,
        COUNT(*) FILTER(WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days')::int as expiring_30d,
        COUNT(*) FILTER(WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '90 days')::int as expiring_90d,
        COUNT(*) FILTER(WHERE expiry_date > NOW() + INTERVAL '90 days')::int as valid
      FROM document_expiry_items WHERE tenant_id = ${tenantId} AND status = 'ACTIVE'
    `;
    return (result as any[])[0];
  }
}

export default DocumentExpiryService;
