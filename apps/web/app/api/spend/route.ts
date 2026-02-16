import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Spend Management — POs, Invoices, 3-Way Matching, Exceptions
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const status = searchParams.get('status');
    const contractId = searchParams.get('contractId');
    const { prisma } = await import('@/lib/prisma');

    if (type === 'purchase-orders') {
      const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${ctx.tenantId}`];
      if (status) conditions.push(Prisma.sql`status = ${status}`);
      if (contractId) conditions.push(Prisma.sql`contract_id = ${contractId}`);
      const where = Prisma.join(conditions, ' AND ');
      const items = await prisma.$queryRaw`SELECT * FROM purchase_orders WHERE ${where} ORDER BY created_at DESC LIMIT 100`;
      return createSuccessResponse(ctx, { purchaseOrders: items });
    }

    if (type === 'invoices') {
      const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${ctx.tenantId}`];
      if (status) conditions.push(Prisma.sql`match_status = ${status}`);
      if (contractId) conditions.push(Prisma.sql`contract_id = ${contractId}`);
      const where = Prisma.join(conditions, ' AND ');
      const items = await prisma.$queryRaw`SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT 100`;
      return createSuccessResponse(ctx, { invoices: items });
    }

    if (type === 'exceptions') {
      const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${ctx.tenantId}`];
      if (status) conditions.push(Prisma.sql`status = ${status}`);
      const where = Prisma.join(conditions, ' AND ');
      const items = await prisma.$queryRaw`SELECT * FROM spend_exceptions WHERE ${where} ORDER BY created_at DESC LIMIT 100`;
      return createSuccessResponse(ctx, { exceptions: items });
    }

    // Overview metrics
    const metrics = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM purchase_orders WHERE tenant_id = ${ctx.tenantId}) as total_pos,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${ctx.tenantId}) as total_invoices,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${ctx.tenantId} AND match_status = 'MATCHED') as matched,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${ctx.tenantId} AND match_status = 'DISCREPANCY') as discrepant,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${ctx.tenantId} AND match_status = 'UNMATCHED') as unmatched,
        (SELECT COUNT(*)::int FROM spend_exceptions WHERE tenant_id = ${ctx.tenantId} AND status = 'OPEN') as open_exceptions,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM purchase_orders WHERE tenant_id = ${ctx.tenantId}) as total_po_value,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM invoices WHERE tenant_id = ${ctx.tenantId}) as total_invoice_value
    `;

    return createSuccessResponse(ctx, { metrics: (metrics as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch spend data. Please try again.`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { type, ...data } = body;

    if (type === 'purchase-order') {
      const result = await prisma.$queryRaw`INSERT INTO purchase_orders (id, tenant_id, po_number, contract_id, vendor_name, status, total_amount, currency, line_items, department, cost_center, budget_code, requested_by, notes)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${data.poNumber}, ${data.contractId || null}, ${data.vendorName}, 'DRAFT', ${data.totalAmount}, ${data.currency || 'USD'}, ${JSON.stringify(data.lineItems || [])}, ${data.department || null}, ${data.costCenter || null}, ${data.budgetCode || null}, ${ctx.userId}, ${data.notes || null}) RETURNING *`;
      return createSuccessResponse(ctx, { purchaseOrder: (result as any[])[0] });
    }

    if (type === 'invoice') {
      const result = await prisma.$queryRaw`INSERT INTO invoices (id, tenant_id, invoice_number, po_id, contract_id, vendor_name, status, total_amount, currency, line_items, invoice_date, due_date, payment_terms, notes)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${data.invoiceNumber}, ${data.poId || null}, ${data.contractId || null}, ${data.vendorName}, 'PENDING', ${data.totalAmount}, ${data.currency || 'USD'}, ${JSON.stringify(data.lineItems || [])}, ${data.invoiceDate || null}, ${data.dueDate || null}, ${data.paymentTerms || null}, ${data.notes || null}) RETURNING *`;
      return createSuccessResponse(ctx, { invoice: (result as any[])[0] });
    }

    if (type === 'match') {
      // 3-way match
      const invoice = await prisma.$queryRaw`SELECT * FROM invoices WHERE id = ${data.invoiceId} AND tenant_id = ${ctx.tenantId}` as any[];
      if (!invoice[0]) return createErrorResponse(ctx, 'NOT_FOUND', 'Invoice not found', 404);

      const discrepancies: any[] = [];
      let matchStatus = 'MATCHED';

      if (invoice[0].po_id) {
        const po = await prisma.$queryRaw`SELECT * FROM purchase_orders WHERE id = ${invoice[0].po_id} AND tenant_id = ${ctx.tenantId}` as any[];
        if (po[0]) {
          const deviation = Math.abs(Number(invoice[0].total_amount) - Number(po[0].total_amount)) / Number(po[0].total_amount) * 100;
          if (deviation > 5) {
            discrepancies.push({ type: 'AMOUNT_MISMATCH', expected: Number(po[0].total_amount), actual: Number(invoice[0].total_amount), deviation: deviation.toFixed(2) });
            matchStatus = 'DISCREPANCY';
          }
        }
      } else {
        matchStatus = 'UNMATCHED';
      }

      await prisma.$queryRaw`UPDATE invoices SET match_status = ${matchStatus}, match_discrepancies = ${JSON.stringify(discrepancies)}, updated_at = NOW() WHERE id = ${data.invoiceId} AND tenant_id = ${ctx.tenantId}`;

      return createSuccessResponse(ctx, { matchStatus, discrepancies });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid type. Use purchase-order, invoice, or match', 400);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create spend record. Please try again.`, 500);
  }
});
