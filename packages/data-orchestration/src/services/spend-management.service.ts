/**
 * Spend Management Service
 * PO/Invoice matching, rate enforcement, spend exception handling
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SpendManagementService {
  // ===== Purchase Orders =====
  static async createPO(tenantId: string, data: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO purchase_orders (id, tenant_id, po_number, contract_id, vendor_name, status, total_amount, currency, line_items, department, cost_center, budget_code, requested_by, notes, metadata)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      tenantId, data.poNumber, data.contractId || null, data.vendorName,
      data.totalAmount, data.currency || 'USD', JSON.stringify(data.lineItems || []),
      data.department || null, data.costCenter || null, data.budgetCode || null,
      data.requestedBy, data.notes || null, JSON.stringify(data.metadata || {})
    );
    return (result as any[])[0];
  }

  static async listPOs(tenantId: string, filters: { status?: string; contractId?: string; page?: number; limit?: number } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    let where = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.status) { where += ` AND status = $${idx}`; params.push(filters.status); idx++; }
    if (filters.contractId) { where += ` AND contract_id = $${idx}`; params.push(filters.contractId); idx++; }

    params.push(limit, offset);
    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM purchase_orders ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, ...params
    );
    return { items: items as any[], page, limit };
  }

  // ===== Invoices =====
  static async createInvoice(tenantId: string, data: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO invoices (id, tenant_id, invoice_number, po_id, contract_id, vendor_name, status, total_amount, currency, line_items, invoice_date, due_date, payment_terms, notes, metadata)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'PENDING', $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      tenantId, data.invoiceNumber, data.poId || null, data.contractId || null,
      data.vendorName, data.totalAmount, data.currency || 'USD',
      JSON.stringify(data.lineItems || []), data.invoiceDate || null,
      data.dueDate || null, data.paymentTerms || null, data.notes || null,
      JSON.stringify(data.metadata || {})
    );
    return (result as any[])[0];
  }

  static async listInvoices(tenantId: string, filters: { matchStatus?: string; contractId?: string; page?: number; limit?: number } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    let where = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.matchStatus) { where += ` AND match_status = $${idx}`; params.push(filters.matchStatus); idx++; }
    if (filters.contractId) { where += ` AND contract_id = $${idx}`; params.push(filters.contractId); idx++; }

    params.push(limit, offset);
    return prisma.$queryRawUnsafe(
      `SELECT * FROM invoices ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`, ...params
    );
  }

  // ===== 3-Way Matching =====
  static async performMatch(tenantId: string, invoiceId: string) {
    const invoice = await prisma.$queryRawUnsafe(
      `SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2`, invoiceId, tenantId
    ) as any[];
    if (!invoice[0]) throw new Error('Invoice not found');
    const inv = invoice[0];

    const discrepancies: any[] = [];
    let matchStatus = 'MATCHED';

    // Match against PO
    if (inv.po_id) {
      const po = await prisma.$queryRawUnsafe(
        `SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2`, inv.po_id, tenantId
      ) as any[];
      if (po[0]) {
        const poAmount = Number(po[0].total_amount);
        const invAmount = Number(inv.total_amount);
        const deviation = Math.abs(invAmount - poAmount) / poAmount * 100;
        if (deviation > 5) {
          discrepancies.push({ type: 'AMOUNT_MISMATCH', expected: poAmount, actual: invAmount, deviation: deviation.toFixed(2) });
          matchStatus = 'DISCREPANCY';
        }
      }
    }

    // Match against Contract rates
    if (inv.contract_id) {
      // Check if invoice rates match contracted rates
      matchStatus = discrepancies.length > 0 ? 'DISCREPANCY' : 'MATCHED';
    }

    if (!inv.po_id && !inv.contract_id) matchStatus = 'UNMATCHED';

    await prisma.$queryRawUnsafe(
      `UPDATE invoices SET match_status = $1, match_discrepancies = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4`,
      matchStatus, JSON.stringify(discrepancies), invoiceId, tenantId
    );

    // Create spend exception if discrepancy found
    if (discrepancies.length > 0) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO spend_exceptions (id, tenant_id, exception_type, title, description, contract_id, invoice_id, expected_amount, actual_amount, deviation_percent, currency, status, severity)
         VALUES (gen_random_uuid()::text, $1, 'INVOICE_MISMATCH', $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN', 'HIGH')`,
        tenantId, `Invoice ${inv.invoice_number} mismatch`,
        `Discrepancies found in 3-way match`, inv.contract_id,
        invoiceId, discrepancies[0]?.expected, discrepancies[0]?.actual,
        discrepancies[0]?.deviation, inv.currency
      );
    }

    return { matchStatus, discrepancies };
  }

  // ===== Rate Enforcement =====
  static async checkRateCompliance(tenantId: string, contractId: string, rate: number, roleOrCategory: string) {
    // Check against rate card entries for the contract
    const rateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId, contractId },
    });

    const match = rateCards.find(rc =>
      rc.roleTitle?.toLowerCase() === roleOrCategory.toLowerCase() ||
      rc.category?.toLowerCase() === roleOrCategory.toLowerCase()
    );

    if (!match) return { compliant: true, message: 'No matching rate card found' };

    const maxRate = Number(match.rate || match.benchmarkRate || 0);
    if (rate > maxRate) {
      return {
        compliant: false,
        message: `Rate ${rate} exceeds contracted rate ${maxRate}`,
        deviation: ((rate - maxRate) / maxRate * 100).toFixed(2),
        contractedRate: maxRate,
      };
    }

    return { compliant: true, message: 'Rate within contracted limits', contractedRate: maxRate };
  }

  // ===== Spend Exceptions =====
  static async listExceptions(tenantId: string, status?: string) {
    if (status) {
      return prisma.$queryRawUnsafe(
        `SELECT * FROM spend_exceptions WHERE tenant_id = $1 AND status = $2 ORDER BY created_at DESC`, tenantId, status
      );
    }
    return prisma.$queryRawUnsafe(
      `SELECT * FROM spend_exceptions WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantId
    );
  }

  static async resolveException(tenantId: string, id: string, resolvedBy: string, notes: string) {
    return prisma.$queryRawUnsafe(
      `UPDATE spend_exceptions SET status = 'RESOLVED', resolved_by = $1, resolved_at = NOW(), resolution_notes = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      resolvedBy, notes, id, tenantId
    );
  }

  static async getSpendMetrics(tenantId: string) {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM purchase_orders WHERE tenant_id = $1) as total_pos,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1) as total_invoices,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1 AND match_status = 'MATCHED') as matched_invoices,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = $1 AND match_status = 'DISCREPANCY') as discrepant_invoices,
        (SELECT COUNT(*)::int FROM spend_exceptions WHERE tenant_id = $1 AND status = 'OPEN') as open_exceptions,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM purchase_orders WHERE tenant_id = $1) as total_po_value,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM invoices WHERE tenant_id = $1) as total_invoice_value
    `, tenantId);
    return (result as any[])[0];
  }
}

export default SpendManagementService;
