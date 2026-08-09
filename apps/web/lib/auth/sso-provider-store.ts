/**
 * Load tenant SSO providers from TenantConfig.securitySettings.
 */

import { prisma } from '@/lib/prisma';
import {
  normalizeSsoProvider,
  type NormalizedSsoProvider,
} from '@/lib/auth/sso-utils';

export async function loadTenantSecuritySettings(tenantId: string): Promise<Record<string, unknown>> {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { securitySettings: true },
  });
  return (config?.securitySettings as Record<string, unknown>) || {};
}

export async function loadSsoProvider(
  tenantId: string,
  providerId: string,
  protocol?: 'saml' | 'oidc',
): Promise<NormalizedSsoProvider | null> {
  const settings = await loadTenantSecuritySettings(tenantId);
  const rawList = (settings.ssoProviders as Array<Record<string, unknown>>) || [];
  const raw = rawList.find((p) => p.id === providerId);
  if (!raw) return null;
  const normalized = normalizeSsoProvider(raw);
  if (!normalized) return null;
  if (protocol && normalized.protocol !== protocol) return null;
  if (normalized.enabled === false) return null;
  return normalized;
}

export async function listEnabledSsoProviders(tenantId: string): Promise<NormalizedSsoProvider[]> {
  const settings = await loadTenantSecuritySettings(tenantId);
  const rawList = (settings.ssoProviders as Array<Record<string, unknown>>) || [];
  return rawList
    .map((p) => normalizeSsoProvider(p))
    .filter((p): p is NormalizedSsoProvider => Boolean(p && p.enabled !== false));
}

export async function getTenantSsoDomainAllowlist(tenantId: string): Promise<string[]> {
  const settings = await loadTenantSecuritySettings(tenantId);
  const fromSettings = settings.ssoAllowedDomains;
  if (Array.isArray(fromSettings)) {
    return fromSettings.map((d) => String(d).toLowerCase().replace(/^@/, ''));
  }
  return [];
}
