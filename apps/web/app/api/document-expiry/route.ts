import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Document Expiry Monitoring API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const vendorName = searchParams.get('vendor');
    const view = searchParams.get('view');
    const { prisma } = await import('@/lib/prisma');

    let items;
    if (view === 'expiring-soon') {
      items = await prisma.$queryRawUnsafe(
        `SELECT *, CASE WHEN expiry_date < NOW() THEN 'EXPIRED' WHEN expiry_date < NOW() + INTERVAL '30 days' THEN 'EXPIRING_SOON' ELSE 'ACTIVE' END as computed_status
         FROM document_expiry_items WHERE tenant_id = $1 AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '90 days' ORDER BY expiry_date ASC`, ctx.tenantId
      );
    } else {
      const conditions = [`tenant_id = $1`];
      const params: unknown[] = [ctx.tenantId];
      if (vendorName) { params.push(`%${vendorName}%`); conditions.push(`vendor_name ILIKE $${params.length}`); }
      items = await prisma.$queryRawUnsafe(
        `SELECT *, CASE WHEN expiry_date < NOW() THEN 'EXPIRED' WHEN expiry_date < NOW() + INTERVAL '30 days' THEN 'EXPIRING_SOON' ELSE 'ACTIVE' END as computed_status
         FROM document_expiry_items WHERE ${conditions.join(' AND ')} ORDER BY expiry_date ASC`, ...params
      );
    }

    const metrics = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE expiry_date < NOW())::int as expired,
        COUNT(*) FILTER(WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days')::int as expiring_30d,
        COUNT(*) FILTER(WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '90 days')::int as expiring_90d,
        COUNT(*) FILTER(WHERE expiry_date > NOW() + INTERVAL '90 days')::int as valid
      FROM document_expiry_items WHERE tenant_id = $1 AND status = 'ACTIVE'
    `, ctx.tenantId);

    return createSuccessResponse(ctx, { documents: items, metrics: (metrics as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch document expiry data: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO document_expiry_items (id, tenant_id, vendor_name, vendor_id, document_type, document_name, file_url, issue_date, expiry_date, alert_days_before, auto_notify, notify_emails, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      ctx.tenantId, body.vendorName, body.vendorId || null, body.documentType,
      body.documentName, body.fileUrl || null, body.issueDate || null,
      body.expiryDate, JSON.stringify(body.alertDaysBefore || [90, 60, 30, 14]),
      body.autoNotify ?? true, JSON.stringify(body.notifyEmails || []), ctx.userId
    );

    return createSuccessResponse(ctx, { document: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create document expiry record: ${error.message}`, 500);
  }
});
