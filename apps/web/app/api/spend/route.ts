import { NextRequest } from 'next/server';
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
      const conditions = [`tenant_id = $1`];
      const params: unknown[] = [ctx.tenantId];
      if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
      if (contractId) { params.push(contractId); conditions.push(`contract_id = $${params.length}`); }
      const items = await prisma.$queryRawUnsafe(`SELECT * FROM purchase_orders WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, ...params);
      return createSuccessResponse(ctx, { purchaseOrders: items });
    }

    if (type === 'invoices') {
      const conditions = [`tenant_id = $1`];
      const params: unknown[] = [ctx.tenantId];
      if (status) { params.push(status); conditions.push(`match_status = $${params.length}`); }
      if (contractId) { params.push(contractId); conditions.push(`contract_id = $${params.length}`); }
      const items = await prisma.$queryRawUnsafe(`SELECT * FROM invoices WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, ...params);
      return createSuccessResponse(ctx, { invoices: items });
    }

    if (type === 'exceptions') {
      const conditions = [`tenant_id = $1`];
      const params: unknown[] = [ctx.tenantId];
      if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
      const items = await prisma.$queryRawUnsafe(`SELECT * FROM spend_exceptions WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`, ...params);
      return createSuccessResponse(ctx, { exceptions: items });
    }

    // Overview metrics
    const metrics = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM purchase_orders WHERE tenant_id = $1) as total_pos,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1) as total_invoices,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1 AND match_status = 'MATCHED') as matched,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1 AND match_status = 'DISCREPANCY') as discrepant,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1 AND match_status = 'UNMATCHED') as unmatched,
        (SELECT COUNT(*)::int FROM spend_exceptions WHERE tenant_id = $1 AND status = 'OPEN') as open_exceptions,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM purchase_orders WHERE tenant_id = $1) as total_po_value,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM invoices WHERE tenant_id = $1) as total_invoice_value
    `, ctx.tenantId);

    return createSuccessResponse(ctx, { metrics: (metrics as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch spend data: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { type, ...data } = body;

    if (type === 'purchase-order') {
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO purchase_orders (id, tenant_id, po_number, contract_id, vendor_name, status, total_amount, currency, line_items, department, cost_center, budget_code, requested_by, notes)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        ctx.tenantId, data.poNumber, data.contractId || null, data.vendorName,
        data.totalAmount, data.currency || 'USD', JSON.stringify(data.lineItems || []),
        data.department || null, data.costCenter || null, data.budgetCode || null,
        ctx.userId, data.notes || null
      );
      return createSuccessResponse(ctx, { purchaseOrder: (result as any[])[0] });
    }

    if (type === 'invoice') {
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO invoices (id, tenant_id, invoice_number, po_id, contract_id, vendor_name, status, total_amount, currency, line_items, invoice_date, due_date, payment_terms, notes)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'PENDING', $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        ctx.tenantId, data.invoiceNumber, data.poId || null, data.contractId || null,
        data.vendorName, data.totalAmount, data.currency || 'USD',
        JSON.stringify(data.lineItems || []), data.invoiceDate || null,
        data.dueDate || null, data.paymentTerms || null, data.notes || null
      );
      return createSuccessResponse(ctx, { invoice: (result as any[])[0] });
    }

    if (type === 'match') {
      // 3-way match
      const invoice = await prisma.$queryRawUnsafe(`SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2`, data.invoiceId, ctx.tenantId) as any[];
      if (!invoice[0]) return createErrorResponse(ctx, 'NOT_FOUND', 'Invoice not found', 404);

      const discrepancies: any[] = [];
      let matchStatus = 'MATCHED';

      if (invoice[0].po_id) {
        const po = await prisma.$queryRawUnsafe(`SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2`, invoice[0].po_id, ctx.tenantId) as any[];
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

      await prisma.$queryRawUnsafe(
        `UPDATE invoices SET match_status = $1, match_discrepancies = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4`,
        matchStatus, JSON.stringify(discrepancies), data.invoiceId, ctx.tenantId
      );

      return createSuccessResponse(ctx, { matchStatus, discrepancies });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid type. Use purchase-order, invoice, or match', 400);
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create spend record: ${error.message}`, 500);
  }
});
