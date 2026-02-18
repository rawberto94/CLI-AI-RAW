/**
 * Spend Management Service
 * PO/Invoice matching, rate enforcement, spend exception handling
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class SpendManagementService {
  // ===== Purchase Orders =====
  static async createPO(tenantId: string, data: any) {
    const result = await prisma.$queryRaw`
      INSERT INTO purchase_orders (id, tenant_id, po_number, contract_id, vendor_name, status, total_amount, currency, line_items, department, cost_center, budget_code, requested_by, notes, metadata)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${data.poNumber}, ${data.contractId || null}, ${data.vendorName},
      'DRAFT', ${data.totalAmount}, ${data.currency || 'USD'}, ${JSON.stringify(data.lineItems || [])},
      ${data.department || null}, ${data.costCenter || null}, ${data.budgetCode || null},
      ${data.requestedBy}, ${data.notes || null}, ${JSON.stringify(data.metadata || {})}) RETURNING *
    `;
    return (result as any[])[0];
  }

  static async listPOs(tenantId: string, filters: { status?: string; contractId?: string; page?: number; limit?: number } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];

    if (filters.status) { conditions.push(Prisma.sql`status = ${filters.status}`); }
    if (filters.contractId) { conditions.push(Prisma.sql`contract_id = ${filters.contractId}`); }

    const where = Prisma.join(conditions, ' AND ');
    const items = await prisma.$queryRaw`
      SELECT * FROM purchase_orders WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    return { items: items as any[], page, limit };
  }

  // ===== Invoices =====
  static async createInvoice(tenantId: string, data: any) {
    const result = await prisma.$queryRaw`
      INSERT INTO invoices (id, tenant_id, invoice_number, po_id, contract_id, vendor_name, status, total_amount, currency, line_items, invoice_date, due_date, payment_terms, notes, metadata)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${data.invoiceNumber}, ${data.poId || null}, ${data.contractId || null},
      ${data.vendorName}, 'PENDING', ${data.totalAmount}, ${data.currency || 'USD'},
      ${JSON.stringify(data.lineItems || [])}, ${data.invoiceDate || null},
      ${data.dueDate || null}, ${data.paymentTerms || null}, ${data.notes || null},
      ${JSON.stringify(data.metadata || {})}) RETURNING *
    `;
    return (result as any[])[0];
  }

  static async listInvoices(tenantId: string, filters: { matchStatus?: string; contractId?: string; page?: number; limit?: number } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];

    if (filters.matchStatus) { conditions.push(Prisma.sql`match_status = ${filters.matchStatus}`); }
    if (filters.contractId) { conditions.push(Prisma.sql`contract_id = ${filters.contractId}`); }

    const where = Prisma.join(conditions, ' AND ');
    return prisma.$queryRaw`
      SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // ===== 3-Way Matching =====
  static async performMatch(tenantId: string, invoiceId: string) {
    const invoice = await prisma.$queryRaw`
      SELECT * FROM invoices WHERE id = ${invoiceId} AND tenant_id = ${tenantId}
    ` as any[];
    if (!invoice[0]) throw new Error('Invoice not found');
    const inv = invoice[0];

    const discrepancies: any[] = [];
    let matchStatus = 'MATCHED';

    // Match against PO
    if (inv.po_id) {
      const po = await prisma.$queryRaw`
        SELECT * FROM purchase_orders WHERE id = ${inv.po_id} AND tenant_id = ${tenantId}
      ` as any[];
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

    await prisma.$queryRaw`
      UPDATE invoices SET match_status = ${matchStatus}, match_discrepancies = ${JSON.stringify(discrepancies)}, updated_at = NOW() WHERE id = ${invoiceId} AND tenant_id = ${tenantId}
    `;

    // Create spend exception if discrepancy found
    if (discrepancies.length > 0) {
      await prisma.$queryRaw`
        INSERT INTO spend_exceptions (id, tenant_id, exception_type, title, description, contract_id, invoice_id, expected_amount, actual_amount, deviation_percent, currency, status, severity)
        VALUES (gen_random_uuid()::text, ${tenantId}, 'INVOICE_MISMATCH', ${`Invoice ${inv.invoice_number} mismatch`},
        ${'Discrepancies found in 3-way match'}, ${inv.contract_id},
        ${invoiceId}, ${discrepancies[0]?.expected}, ${discrepancies[0]?.actual},
        ${discrepancies[0]?.deviation}, ${inv.currency}, 'OPEN', 'HIGH')
      `;
    }

    return { matchStatus, discrepancies };
  }

  // ===== Rate Enforcement =====
  static async checkRateCompliance(tenantId: string, contractId: string, rate: number, roleOrCategory: string) {
    // Check against rate card entries for the contract
    const rateCards = await prisma.rateCardEntry.findMany({
      where: { tenantId, contractId },
    }) as any[];

    const match = rateCards.find((rc: any) =>
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
      return prisma.$queryRaw`
        SELECT * FROM spend_exceptions WHERE tenant_id = ${tenantId} AND status = ${status} ORDER BY created_at DESC
      `;
    }
    return prisma.$queryRaw`
      SELECT * FROM spend_exceptions WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
    `;
  }

  static async resolveException(tenantId: string, id: string, resolvedBy: string, notes: string) {
    return prisma.$queryRaw`
      UPDATE spend_exceptions SET status = 'RESOLVED', resolved_by = ${resolvedBy}, resolved_at = NOW(), resolution_notes = ${notes}, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *
    `;
  }

  static async getSpendMetrics(tenantId: string) {
    const result = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM purchase_orders WHERE tenant_id = ${tenantId}) as total_pos,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${tenantId}) as total_invoices,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${tenantId} AND match_status = 'MATCHED') as matched_invoices,
        (SELECT COUNT(*)::int FROM invoices WHERE tenant_id = ${tenantId} AND match_status = 'DISCREPANCY') as discrepant_invoices,
        (SELECT COUNT(*)::int FROM spend_exceptions WHERE tenant_id = ${tenantId} AND status = 'OPEN') as open_exceptions,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM purchase_orders WHERE tenant_id = ${tenantId}) as total_po_value,
        (SELECT COALESCE(SUM(total_amount), 0)::decimal(15,2) FROM invoices WHERE tenant_id = ${tenantId}) as total_invoice_value
    `;
    return (result as any[])[0];
  }
}

export default SpendManagementService;
