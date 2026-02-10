/**
 * Contract Request Service
 * Handles intake form submissions, triage, routing, and SLA tracking
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ContractRequestInput {
  tenantId: string;
  requesterId: string;
  title: string;
  description?: string;
  requestType?: string;
  urgency?: string;
  department?: string;
  costCenter?: string;
  estimatedValue?: number;
  currency?: string;
  counterpartyName?: string;
  counterpartyEmail?: string;
  contractType?: string;
  desiredStartDate?: Date;
  desiredEndDate?: Date;
  businessJustification?: string;
  attachments?: object[];
  customFields?: Record<string, unknown>;
}

export interface TriageInput {
  assignedTo?: string;
  triageNotes?: string;
  triagePriority?: string;
  triagedBy: string;
}

const SLA_HOURS: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

export class ContractRequestService {
  static async create(input: ContractRequestInput) {
    const slaHours = SLA_HOURS[input.urgency || 'MEDIUM'] || 72;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const request = await prisma.$queryRawUnsafe(
      `INSERT INTO contract_requests (id, tenant_id, requester_id, title, description, request_type, urgency, department, cost_center, estimated_value, currency, counterparty_name, counterparty_email, contract_type, desired_start_date, desired_end_date, business_justification, attachments, custom_fields, status, sla_deadline, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'SUBMITTED', $19, NOW(), NOW())
       RETURNING *`,
      input.tenantId,
      input.requesterId,
      input.title,
      input.description || null,
      input.requestType || 'NEW_CONTRACT',
      input.urgency || 'MEDIUM',
      input.department || null,
      input.costCenter || null,
      input.estimatedValue || null,
      input.currency || 'USD',
      input.counterpartyName || null,
      input.counterpartyEmail || null,
      input.contractType || null,
      input.desiredStartDate || null,
      input.desiredEndDate || null,
      input.businessJustification || null,
      JSON.stringify(input.attachments || []),
      JSON.stringify(input.customFields || {}),
      slaDeadline
    );

    // Auto-route based on rules
    await ContractRequestService.autoRoute(
      input.tenantId,
      (request as any[])[0]
    );

    return (request as any[])[0];
  }

  static async list(tenantId: string, filters: {
    status?: string;
    assignedTo?: string;
    requesterId?: string;
    urgency?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters.assignedTo) {
      whereClause += ` AND assigned_to = $${paramIndex}`;
      params.push(filters.assignedTo);
      paramIndex++;
    }
    if (filters.requesterId) {
      whereClause += ` AND requester_id = $${paramIndex}`;
      params.push(filters.requesterId);
      paramIndex++;
    }
    if (filters.urgency) {
      whereClause += ` AND urgency = $${paramIndex}`;
      params.push(filters.urgency);
      paramIndex++;
    }

    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM contract_requests ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...params, limit, offset
    );

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM contract_requests ${whereClause}`,
      ...params
    );

    return {
      items: items as any[],
      total: (countResult as any[])[0]?.total || 0,
      page,
      limit,
    };
  }

  static async getById(tenantId: string, id: string) {
    const result = await prisma.$queryRawUnsafe(
      `SELECT * FROM contract_requests WHERE id = $1 AND tenant_id = $2`,
      id, tenantId
    );
    return (result as any[])[0] || null;
  }

  static async triage(tenantId: string, id: string, input: TriageInput) {
    const result = await prisma.$queryRawUnsafe(
      `UPDATE contract_requests SET assigned_to = $1, triage_notes = $2, triage_priority = $3, triaged_by = $4, triaged_at = NOW(), status = 'IN_TRIAGE', updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      input.assignedTo || null,
      input.triageNotes || null,
      input.triagePriority || null,
      input.triagedBy,
      id,
      tenantId
    );
    return (result as any[])[0] || null;
  }

  static async updateStatus(tenantId: string, id: string, status: string, extras: Record<string, any> = {}) {
    const setClauses = ['status = $1', 'updated_at = NOW()'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (extras.rejectedReason) {
      setClauses.push(`rejected_reason = $${paramIndex}`);
      params.push(extras.rejectedReason);
      paramIndex++;
    }
    if (extras.contractId) {
      setClauses.push(`contract_id = $${paramIndex}`);
      params.push(extras.contractId);
      paramIndex++;
    }

    params.push(id, tenantId);

    const result = await prisma.$queryRawUnsafe(
      `UPDATE contract_requests SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      ...params
    );
    return (result as any[])[0] || null;
  }

  static async autoRoute(tenantId: string, request: any) {
    const rules = await prisma.$queryRawUnsafe(
      `SELECT * FROM routing_rules WHERE tenant_id = $1 AND is_active = true ORDER BY priority DESC`,
      tenantId
    ) as any[];

    for (const rule of rules) {
      if (ContractRequestService.matchesConditions(request, rule.conditions)) {
        await prisma.$queryRawUnsafe(
          `UPDATE contract_requests SET assigned_to = COALESCE($1, assigned_to), assigned_team = COALESCE($2, NULL), sla_deadline = COALESCE($3, sla_deadline), updated_at = NOW() WHERE id = $4`,
          rule.assigned_user,
          rule.assigned_team,
          rule.sla_hours ? new Date(Date.now() + rule.sla_hours * 60 * 60 * 1000) : null,
          request.id
        );
        break;
      }
    }
  }

  static matchesConditions(request: any, conditions: any[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond: any) => {
      const value = request[cond.field];
      switch (cond.operator) {
        case 'equals': return value === cond.value;
        case 'contains': return String(value).toLowerCase().includes(String(cond.value).toLowerCase());
        case 'gt': return Number(value) > Number(cond.value);
        case 'lt': return Number(value) < Number(cond.value);
        case 'gte': return Number(value) >= Number(cond.value);
        case 'in': return Array.isArray(cond.value) && cond.value.includes(value);
        default: return true;
      }
    });
  }

  static async getMetrics(tenantId: string) {
    const metrics = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'SUBMITTED')::int as submitted,
        COUNT(*) FILTER(WHERE status = 'IN_TRIAGE')::int as in_triage,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'IN_PROGRESS')::int as in_progress,
        COUNT(*) FILTER(WHERE status = 'COMPLETED')::int as completed,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected,
        COUNT(*) FILTER(WHERE escalated = true)::int as escalated,
        COUNT(*) FILTER(WHERE sla_deadline < NOW() AND status NOT IN ('COMPLETED','REJECTED','CANCELLED'))::int as sla_breached,
        AVG(EXTRACT(EPOCH FROM (COALESCE(triaged_at, NOW()) - created_at)) / 3600)::decimal(10,1) as avg_triage_hours
      FROM contract_requests WHERE tenant_id = $1
    `, tenantId);

    return (metrics as any[])[0];
  }

  static async checkEscalations(tenantId: string) {
    // Find requests past SLA deadline that haven't been escalated
    const overdue = await prisma.$queryRawUnsafe(`
      UPDATE contract_requests
      SET escalated = true, escalated_at = NOW(), updated_at = NOW()
      WHERE tenant_id = $1 AND sla_deadline < NOW() AND escalated = false
        AND status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')
      RETURNING *
    `, tenantId);

    return overdue as any[];
  }
}

export default ContractRequestService;
