/**
 * Enterprise Security Service
 * API key management, DLP, legal hold, SCIM, SIEM streaming
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

export class EnterpriseSecurityService {
  // ===== API Key Management =====
  static async createApiKey(tenantId: string, userId: string, name: string, scopes: string[] = ['read'], expiresInDays?: number) {
    const rawKey = `ctg_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

    await prisma.$queryRaw`
      INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, key_prefix, scopes, expires_at)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${userId}, ${name}, ${keyHash}, ${keyPrefix}, ${JSON.stringify(scopes)}, ${expiresAt})
    `;

    return { key: rawKey, keyPrefix, name, scopes, expiresAt };
  }

  static async validateApiKey(key: string) {
    const keyHash = createHash('sha256').update(key).digest('hex');
    const result = await prisma.$queryRaw`
      UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1, updated_at = NOW()
      WHERE key_hash = ${keyHash} AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())
      RETURNING *
    `;
    return (result as any[])[0] || null;
  }

  static async listApiKeys(tenantId: string) {
    return prisma.$queryRaw`
      SELECT id, name, key_prefix, scopes, is_active, last_used_at, usage_count, expires_at, created_at
      FROM api_keys WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
    `;
  }

  static async revokeApiKey(tenantId: string, id: string) {
    return prisma.$queryRaw`
      UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id, name, key_prefix
    `;
  }

  // ===== Legal Holds =====
  static async createLegalHold(tenantId: string, data: any) {
    const result = await prisma.$queryRaw`
      INSERT INTO legal_holds (id, tenant_id, name, description, matter_id, hold_type, contract_ids, obligation_ids, custodians, issued_by)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${data.name}, ${data.description || null}, ${data.matterId || null},
      ${data.holdType || 'LITIGATION'}, ${JSON.stringify(data.contractIds || [])},
      ${JSON.stringify(data.obligationIds || [])}, ${JSON.stringify(data.custodians || [])},
      ${data.issuedBy}) RETURNING *
    `;
    return (result as any[])[0];
  }

  static async listLegalHolds(tenantId: string, status?: string) {
    if (status) {
      return prisma.$queryRaw`
        SELECT * FROM legal_holds WHERE tenant_id = ${tenantId} AND status = ${status} ORDER BY issued_at DESC
      `;
    }
    return prisma.$queryRaw`
      SELECT * FROM legal_holds WHERE tenant_id = ${tenantId} ORDER BY issued_at DESC
    `;
  }

  static async releaseLegalHold(tenantId: string, id: string, releasedBy: string, reason: string) {
    return prisma.$queryRaw`
      UPDATE legal_holds SET status = 'RELEASED', released_by = ${releasedBy}, released_at = NOW(), release_reason = ${reason}, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *
    `;
  }

  static async isUnderHold(tenantId: string, contractId: string): Promise<boolean> {
    const result = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM legal_holds WHERE tenant_id = ${tenantId} AND status = 'ACTIVE' AND contract_ids @> ${JSON.stringify([contractId])}::jsonb
    `;
    return (result as any[])[0]?.count > 0;
  }

  // ===== DLP Policies =====
  static async createDlpPolicy(tenantId: string, data: any) {
    const result = await prisma.$queryRaw`
      INSERT INTO dlp_policies (id, tenant_id, name, description, policy_type, rules, actions, applies_to_roles, is_active, created_by)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${data.name}, ${data.description || null}, ${data.policyType || 'DOWNLOAD_RESTRICTION'},
      ${JSON.stringify(data.rules || [])},
      ${JSON.stringify(data.actions || { block: false, alert: true, log: true })},
      ${JSON.stringify(data.appliesToRoles || [])}, ${data.isActive ?? true}, ${data.createdBy}) RETURNING *
    `;
    return (result as any[])[0];
  }

  static async listDlpPolicies(tenantId: string) {
    return prisma.$queryRaw`
      SELECT * FROM dlp_policies WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
    `;
  }

  static async checkDlpCompliance(tenantId: string, action: string, userRole: string) {
    const policies = await prisma.$queryRaw`
      SELECT * FROM dlp_policies WHERE tenant_id = ${tenantId} AND is_active = true AND policy_type = ${action}
    ` as any[];

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
    const result = await prisma.$queryRaw`
      INSERT INTO scim_sync_records (id, tenant_id, scim_id, resource_type, internal_id, display_name, email, active, sync_source, raw_attributes, last_synced_at)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${scimData.id}, ${scimData.resourceType || 'User'},
      ${scimData.internalId}, ${scimData.displayName}, ${scimData.email},
      ${scimData.active ?? true}, ${scimData.syncSource || 'ENTRA_ID'},
      ${JSON.stringify(scimData.rawAttributes || {})}, NOW())
      ON CONFLICT (tenant_id, scim_id) DO UPDATE SET
        display_name = ${scimData.displayName}, email = ${scimData.email}, active = ${scimData.active ?? true}, raw_attributes = ${JSON.stringify(scimData.rawAttributes || {})}, last_synced_at = NOW(), updated_at = NOW()
      RETURNING *
    `;
    return (result as any[])[0];
  }

  static async listScimUsers(tenantId: string) {
    return prisma.$queryRaw`
      SELECT * FROM scim_sync_records WHERE tenant_id = ${tenantId} AND resource_type = 'User' ORDER BY display_name
    `;
  }

  // ===== Tenant AI Policies =====
  static async getAiPolicy(tenantId: string) {
    const r = await prisma.$queryRaw`
      SELECT * FROM tenant_ai_policies WHERE tenant_id = ${tenantId}
    `;
    return (r as any[])[0] || null;
  }

  static async upsertAiPolicy(tenantId: string, data: any) {
    const result = await prisma.$queryRaw`
      INSERT INTO tenant_ai_policies (id, tenant_id, allowed_models, max_tokens_per_request, enable_extraction, enable_generation, enable_chat, confidence_threshold, require_human_review, review_threshold, data_retention_days, pii_masking, audit_all_requests, custom_rules, updated_by)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${JSON.stringify(data.allowedModels || ['gpt-4o', 'gpt-4o-mini'])},
      ${data.maxTokensPerRequest || 4096}, ${data.enableExtraction ?? true},
      ${data.enableGeneration ?? true}, ${data.enableChat ?? true},
      ${data.confidenceThreshold || 0.7}, ${data.requireHumanReview ?? false},
      ${data.reviewThreshold || 0.5}, ${data.dataRetentionDays || 90},
      ${data.piiMasking ?? false}, ${data.auditAllRequests ?? true},
      ${JSON.stringify(data.customRules || {})}, ${data.updatedBy})
      ON CONFLICT (tenant_id) DO UPDATE SET
        allowed_models = ${JSON.stringify(data.allowedModels || ['gpt-4o', 'gpt-4o-mini'])}, max_tokens_per_request = ${data.maxTokensPerRequest || 4096}, enable_extraction = ${data.enableExtraction ?? true}, enable_generation = ${data.enableGeneration ?? true},
        enable_chat = ${data.enableChat ?? true}, confidence_threshold = ${data.confidenceThreshold || 0.7}, require_human_review = ${data.requireHumanReview ?? false}, review_threshold = ${data.reviewThreshold || 0.5},
        data_retention_days = ${data.dataRetentionDays || 90}, pii_masking = ${data.piiMasking ?? false}, audit_all_requests = ${data.auditAllRequests ?? true}, custom_rules = ${JSON.stringify(data.customRules || {})}, updated_by = ${data.updatedBy}, updated_at = NOW()
      RETURNING *
    `;
    return (result as any[])[0];
  }

  // ===== Records Management =====
  static async archiveContract(tenantId: string, contractId: string, reason: string, archivedBy: string) {
    // Fetch contract data
    const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
    if (!contract) throw new Error('Contract not found');

    const retentionYears = 7; // Default 7 year retention
    const retentionUntil = new Date(Date.now() + retentionYears * 365 * 86400000);

    await prisma.$queryRaw`
      INSERT INTO archived_contracts (id, tenant_id, original_contract_id, archive_reason, archived_data, retention_until, storage_tier, archived_by)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${contractId}, ${reason}, ${JSON.stringify(contract)}, ${retentionUntil}, 'COOL', ${archivedBy})
    `;

    return { archived: true, retentionUntil };
  }

  static async createDeletionCertificate(tenantId: string, data: any) {
    const certHash = createHash('sha256')
      .update(`${tenantId}:${data.entityType}:${data.entityId}:${Date.now()}`)
      .digest('hex');

    const result = await prisma.$queryRaw`
      INSERT INTO deletion_certificates (id, tenant_id, entity_type, entity_id, entity_title, deletion_reason, approved_by, approved_at, executed_by, certificate_hash, metadata)
      VALUES (gen_random_uuid()::text, ${tenantId}, ${data.entityType}, ${data.entityId}, ${data.entityTitle || null},
      ${data.deletionReason}, ${data.approvedBy}, ${data.approvedAt || new Date()},
      ${data.executedBy}, ${certHash}, ${JSON.stringify(data.metadata || {})}) RETURNING *
    `;
    return (result as any[])[0];
  }
}

export default EnterpriseSecurityService;
