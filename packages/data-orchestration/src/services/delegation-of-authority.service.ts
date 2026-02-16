/**
 * Delegation of Authority Service
 * Manages configurable approval authority levels by role, department, and value
 */

import { Prisma, PrismaClient } from '@prisma/client';

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
    const result = await prisma.$queryRaw`INSERT INTO delegation_of_authority (id, tenant_id, name, role, department, contract_types, max_value, currency, requires_counter_sign, counter_sign_role, can_delegate, delegation_depth, conditions, is_active, effective_from, effective_until, created_by)
       VALUES (gen_random_uuid()::text, ${input.tenantId}, ${input.name}, ${input.role}, ${input.department || null},
      ${JSON.stringify(input.contractTypes || [])}, ${input.maxValue || null},
      ${input.currency || 'USD'}, ${input.requiresCounterSign ?? false},
      ${input.counterSignRole || null}, ${input.canDelegate ?? true},
      ${input.delegationDepth || 1}, ${JSON.stringify(input.conditions || {})},
      ${input.isActive ?? true}, ${input.effectiveFrom || null},
      ${input.effectiveUntil || null}, ${input.createdBy}) RETURNING *`;
    return (result as any[])[0];
  }

  static async list(tenantId: string) {
    return prisma.$queryRaw`SELECT * FROM delegation_of_authority WHERE tenant_id = ${tenantId} ORDER BY max_value ASC NULLS LAST`;
  }

  static async getById(tenantId: string, id: string) {
    const r = await prisma.$queryRaw`SELECT * FROM delegation_of_authority WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (r as any[])[0] || null;
  }

  static async update(tenantId: string, id: string, data: Partial<DoAEntry>) {
    const sets: Prisma.Sql[] = [Prisma.sql`updated_at = NOW()`];

    if (data.name !== undefined) sets.push(Prisma.sql`name = ${data.name}`);
    if (data.role !== undefined) sets.push(Prisma.sql`role = ${data.role}`);
    if (data.department !== undefined) sets.push(Prisma.sql`department = ${data.department}`);
    if (data.contractTypes !== undefined) sets.push(Prisma.sql`contract_types = ${JSON.stringify(data.contractTypes)}`);
    if (data.maxValue !== undefined) sets.push(Prisma.sql`max_value = ${data.maxValue}`);
    if (data.currency !== undefined) sets.push(Prisma.sql`currency = ${data.currency}`);
    if (data.requiresCounterSign !== undefined) sets.push(Prisma.sql`requires_counter_sign = ${data.requiresCounterSign}`);
    if (data.counterSignRole !== undefined) sets.push(Prisma.sql`counter_sign_role = ${data.counterSignRole}`);
    if (data.canDelegate !== undefined) sets.push(Prisma.sql`can_delegate = ${data.canDelegate}`);
    if (data.delegationDepth !== undefined) sets.push(Prisma.sql`delegation_depth = ${data.delegationDepth}`);
    if (data.conditions !== undefined) sets.push(Prisma.sql`conditions = ${JSON.stringify(data.conditions)}`);
    if (data.isActive !== undefined) sets.push(Prisma.sql`is_active = ${data.isActive}`);

    const setClause = Prisma.join(sets, ', ');
    const r = await prisma.$queryRaw`UPDATE delegation_of_authority SET ${setClause} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`;
    return (r as any[])[0] || null;
  }

  static async delete(tenantId: string, id: string) {
    await prisma.$queryRaw`DELETE FROM delegation_of_authority WHERE id = ${id} AND tenant_id = ${tenantId}`;
  }

  static async checkAuthority(tenantId: string, userRole: string, contractType: string, value: number) {
    const entries = await prisma.$queryRaw`SELECT * FROM delegation_of_authority WHERE tenant_id = ${tenantId} AND role = ${userRole} AND is_active = true
       AND (effective_from IS NULL OR effective_from <= NOW())
       AND (effective_until IS NULL OR effective_until >= NOW())
       ORDER BY max_value DESC` as any[];

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
