/**
 * Enterprise Security Service
 * API key management, DLP, legal hold, SCIM, SIEM streaming
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

export class EnterpriseSecurityService {
  // ===== API Key Management =====
  static async createApiKey(tenantId: string, userId: string, name: string, scopes: string[] = ['read'], expiresInDays?: number) {
    const rawKey = `ctg_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

    await prisma.$queryRawUnsafe(
      `INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, key_prefix, scopes, expires_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)`,
      tenantId, userId, name, keyHash, keyPrefix, JSON.stringify(scopes), expiresAt
    );

    return { key: rawKey, keyPrefix, name, scopes, expiresAt };
  }

  static async validateApiKey(key: string) {
    const keyHash = createHash('sha256').update(key).digest('hex');
    const result = await prisma.$queryRawUnsafe(
      `UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1, updated_at = NOW()
       WHERE key_hash = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING *`, keyHash
    );
    return (result as any[])[0] || null;
  }

  static async listApiKeys(tenantId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT id, name, key_prefix, scopes, is_active, last_used_at, usage_count, expires_at, created_at
       FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantId
    );
  }

  static async revokeApiKey(tenantId: string, id: string) {
    return prisma.$queryRawUnsafe(
      `UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id, name, key_prefix`, id, tenantId
    );
  }

  // ===== Legal Holds =====
  static async createLegalHold(tenantId: string, data: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO legal_holds (id, tenant_id, name, description, matter_id, hold_type, contract_ids, obligation_ids, custodians, issued_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      tenantId, data.name, data.description || null, data.matterId || null,
      data.holdType || 'LITIGATION', JSON.stringify(data.contractIds || []),
      JSON.stringify(data.obligationIds || []), JSON.stringify(data.custodians || []),
      data.issuedBy
    );
    return (result as any[])[0];
  }

  static async listLegalHolds(tenantId: string, status?: string) {
    if (status) {
      return prisma.$queryRawUnsafe(
        `SELECT * FROM legal_holds WHERE tenant_id = $1 AND status = $2 ORDER BY issued_at DESC`, tenantId, status
      );
    }
    return prisma.$queryRawUnsafe(
      `SELECT * FROM legal_holds WHERE tenant_id = $1 ORDER BY issued_at DESC`, tenantId
    );
  }

  static async releaseLegalHold(tenantId: string, id: string, releasedBy: string, reason: string) {
    return prisma.$queryRawUnsafe(
      `UPDATE legal_holds SET status = 'RELEASED', released_by = $1, released_at = NOW(), release_reason = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 RETURNING *`, releasedBy, reason, id, tenantId
    );
  }

  static async isUnderHold(tenantId: string, contractId: string): Promise<boolean> {
    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM legal_holds WHERE tenant_id = $1 AND status = 'ACTIVE' AND contract_ids @> $2::jsonb`,
      tenantId, JSON.stringify([contractId])
    );
    return (result as any[])[0]?.count > 0;
  }

  // ===== DLP Policies =====
  static async createDlpPolicy(tenantId: string, data: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO dlp_policies (id, tenant_id, name, description, policy_type, rules, actions, applies_to_roles, is_active, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      tenantId, data.name, data.description || null, data.policyType || 'DOWNLOAD_RESTRICTION',
      JSON.stringify(data.rules || []),
      JSON.stringify(data.actions || { block: false, alert: true, log: true }),
      JSON.stringify(data.appliesToRoles || []), data.isActive ?? true, data.createdBy
    );
    return (result as any[])[0];
  }

  static async listDlpPolicies(tenantId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM dlp_policies WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantId
    );
  }

  static async checkDlpCompliance(tenantId: string, action: string, userRole: string) {
    const policies = await prisma.$queryRawUnsafe(
      `SELECT * FROM dlp_policies WHERE tenant_id = $1 AND is_active = true AND policy_type = $2`, tenantId, action
    ) as any[];

    for (const policy of policies) {
      const roles = policy.applies_to_roles || [];
      if (roles.length > 0 && !roles.includes(userRole)) continue;
      const actions = policy.actions || {};
      if (actions.block) return { allowed: false, policy: policy.name, action: 'BLOCKED' };
      if (actions.alert) return { allowed: true, policy: policy.name, action: 'ALERT' };
    }
    return { allowed: true, policy: null, action: 'ALLOWED' };
  }

  // ===== SCIM =====
  static async syncScimUser(tenantId: string, scimData: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO scim_sync_records (id, tenant_id, scim_id, resource_type, internal_id, display_name, email, active, sync_source, raw_attributes, last_synced_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (tenant_id, scim_id) DO UPDATE SET
         display_name = $5, email = $6, active = $7, raw_attributes = $9, last_synced_at = NOW(), updated_at = NOW()
       RETURNING *`,
      tenantId, scimData.id, scimData.resourceType || 'User',
      scimData.internalId, scimData.displayName, scimData.email,
      scimData.active ?? true, scimData.syncSource || 'ENTRA_ID',
      JSON.stringify(scimData.rawAttributes || {})
    );
    return (result as any[])[0];
  }

  static async listScimUsers(tenantId: string) {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM scim_sync_records WHERE tenant_id = $1 AND resource_type = 'User' ORDER BY display_name`, tenantId
    );
  }

  // ===== Tenant AI Policies =====
  static async getAiPolicy(tenantId: string) {
    const r = await prisma.$queryRawUnsafe(
      `SELECT * FROM tenant_ai_policies WHERE tenant_id = $1`, tenantId
    );
    return (r as any[])[0] || null;
  }

  static async upsertAiPolicy(tenantId: string, data: any) {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO tenant_ai_policies (id, tenant_id, allowed_models, max_tokens_per_request, enable_extraction, enable_generation, enable_chat, confidence_threshold, require_human_review, review_threshold, data_retention_days, pii_masking, audit_all_requests, custom_rules, updated_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (tenant_id) DO UPDATE SET
         allowed_models = $2, max_tokens_per_request = $3, enable_extraction = $4, enable_generation = $5,
         enable_chat = $6, confidence_threshold = $7, require_human_review = $8, review_threshold = $9,
         data_retention_days = $10, pii_masking = $11, audit_all_requests = $12, custom_rules = $13, updated_by = $14, updated_at = NOW()
       RETURNING *`,
      tenantId, JSON.stringify(data.allowedModels || ['gpt-4o', 'gpt-4o-mini']),
      data.maxTokensPerRequest || 4096, data.enableExtraction ?? true,
      data.enableGeneration ?? true, data.enableChat ?? true,
      data.confidenceThreshold || 0.7, data.requireHumanReview ?? false,
      data.reviewThreshold || 0.5, data.dataRetentionDays || 90,
      data.piiMasking ?? false, data.auditAllRequests ?? true,
      JSON.stringify(data.customRules || {}), data.updatedBy
    );
    return (result as any[])[0];
  }

  // ===== Records Management =====
  static async archiveContract(tenantId: string, contractId: string, reason: string, archivedBy: string) {
    // Fetch contract data
    const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
    if (!contract) throw new Error('Contract not found');

    const retentionYears = 7; // Default 7 year retention
    const retentionUntil = new Date(Date.now() + retentionYears * 365 * 86400000);

    await prisma.$queryRawUnsafe(
      `INSERT INTO archived_contracts (id, tenant_id, original_contract_id, archive_reason, archived_data, retention_until, storage_tier, archived_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 'COOL', $6)`,
      tenantId, contractId, reason, JSON.stringify(contract), retentionUntil, archivedBy
    );

    return { archived: true, retentionUntil };
  }

  static async createDeletionCertificate(tenantId: string, data: any) {
    const certHash = createHash('sha256')
      .update(`${tenantId}:${data.entityType}:${data.entityId}:${Date.now()}`)
      .digest('hex');

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO deletion_certificates (id, tenant_id, entity_type, entity_id, entity_title, deletion_reason, approved_by, approved_at, executed_by, certificate_hash, metadata)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      tenantId, data.entityType, data.entityId, data.entityTitle || null,
      data.deletionReason, data.approvedBy, data.approvedAt || new Date(),
      data.executedBy, certHash, JSON.stringify(data.metadata || {})
    );
    return (result as any[])[0];
  }
}

export default EnterpriseSecurityService;
