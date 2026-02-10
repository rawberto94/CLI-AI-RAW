/**
 * Delegation of Authority Service
 * Manages configurable approval authority levels by role, department, and value
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DoAEntry {
  tenantId: string;
  name: string;
  role: string;
  department?: string;
  contractTypes?: string[];
  maxValue?: number;
  currency?: string;
  requiresCounterSign?: boolean;
  counterSignRole?: string;
  canDelegate?: boolean;
  delegationDepth?: number;
  conditions?: Record<string, unknown>;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  createdBy: string;
}

export class DelegationOfAuthorityService {
  static async create(input: DoAEntry) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO delegation_of_authority (id, tenant_id, name, role, department, contract_types, max_value, currency, requires_counter_sign, counter_sign_role, can_delegate, delegation_depth, conditions, is_active, effective_from, effective_until, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      input.tenantId, input.name, input.role, input.department || null,
      JSON.stringify(input.contractTypes || []), input.maxValue || null,
      input.currency || 'USD', input.requiresCounterSign ?? false,
      input.counterSignRole || null, input.canDelegate ?? true,
      input.delegationDepth || 1, JSON.stringify(input.conditions || {}),
      input.isActive ?? true, input.effectiveFrom || null,
      input.effectiveUntil || null, input.createdBy
    );
    return (result as any[])[0];
  }

  static async list(tenantId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM delegation_of_authority WHERE tenant_id = $1 ORDER BY max_value ASC NULLS LAST`, tenantId
    );
  }

  static async getById(tenantId: string, id: string) {
    const r = await prisma.$queryRawUnsafe(
      `SELECT * FROM delegation_of_authority WHERE id = $1 AND tenant_id = $2`, id, tenantId
    );
    return (r as any[])[0] || null;
  }

  static async update(tenantId: string, id: string, data: Partial<DoAEntry>) {
    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    const fields: [string, any][] = [
      ['name', data.name], ['role', data.role], ['department', data.department],
      ['contract_types', data.contractTypes ? JSON.stringify(data.contractTypes) : undefined],
      ['max_value', data.maxValue], ['currency', data.currency],
      ['requires_counter_sign', data.requiresCounterSign],
      ['counter_sign_role', data.counterSignRole],
      ['can_delegate', data.canDelegate], ['delegation_depth', data.delegationDepth],
      ['conditions', data.conditions ? JSON.stringify(data.conditions) : undefined],
      ['is_active', data.isActive],
    ];

    for (const [col, val] of fields) {
      if (val !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(val);
        idx++;
      }
    }

    params.push(id, tenantId);
    const r = await prisma.$queryRawUnsafe(
      `UPDATE delegation_of_authority SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      ...params
    );
    return (r as any[])[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    await prisma.$queryRawUnsafe(
      `DELETE FROM delegation_of_authority WHERE id = $1 AND tenant_id = $2`, id, tenantId
    );
  }

  static async checkAuthority(tenantId: string, userRole: string, contractType: string, value: number) {
    const entries = await prisma.$queryRawUnsafe(
      `SELECT * FROM delegation_of_authority WHERE tenant_id = $1 AND role = $2 AND is_active = true
       AND (effective_from IS NULL OR effective_from <= NOW())
       AND (effective_until IS NULL OR effective_until >= NOW())
       ORDER BY max_value DESC`, tenantId, userRole
    ) as any[];

    for (const entry of entries) {
      const types = entry.contract_types || [];
      if (types.length > 0 && !types.includes(contractType)) continue;
      if (entry.max_value !== null && value > Number(entry.max_value)) continue;
      return { authorized: true, entry, requiresCounterSign: entry.requires_counter_sign };
    }

    return { authorized: false, entry: null, requiresCounterSign: false };
  }
}

export default DelegationOfAuthorityService;
