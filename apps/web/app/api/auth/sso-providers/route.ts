/**
 * Dynamic SSO Providers API
 * GET /api/auth/sso-providers?tenantId=
 *
 * Returns merged list of SSO providers from environment variables
 * and tenant-specific admin configuration (SAML + tenant OIDC).
 */

import { NextRequest } from 'next/server';
import { getPublicApiContext, createSuccessResponse } from '@/lib/api-middleware';
import { listEnabledSsoProviders } from '@/lib/auth/sso-provider-store';

export const dynamic = 'force-dynamic';

interface SSOProviderInfo {
  id: string;
  name: string;
  protocol: 'oidc' | 'saml';
  enabled: boolean;
  domain?: string;
  /** Client login URL for tenant-configured providers */
  loginUrl?: string;
  global?: boolean;
}

export async function GET(request: NextRequest) {
  const ctx = getPublicApiContext(request);
  const baseUrl = process.env.NEXTAUTH_URL || '';

  const providers: SSOProviderInfo[] = [];

  // Environment-based global OIDC providers (NextAuth)
  if (process.env.GOOGLE_CLIENT_ID) {
    providers.push({ id: 'google', name: 'Google', protocol: 'oidc', enabled: true, global: true });
  }
  if (process.env.AZURE_AD_CLIENT_ID) {
    providers.push({
      id: 'microsoft-entra-id',
      name: 'Microsoft Entra ID',
      protocol: 'oidc',
      enabled: true,
      global: true,
    });
  }
  if (process.env.GITHUB_CLIENT_ID) {
    providers.push({ id: 'github', name: 'GitHub', protocol: 'oidc', enabled: true, global: true });
  }

  // Tenant-specific providers (SAML / custom OIDC)
  try {
    const tenantId =
      request.headers.get('x-tenant-id') ||
      new URL(request.url).searchParams.get('tenantId') ||
      undefined;

    if (tenantId) {
      const tenantProviders = await listEnabledSsoProviders(tenantId);
      for (const provider of tenantProviders) {
        if (providers.some((p) => p.id === provider.id)) continue;
        const loginUrl =
          provider.protocol === 'saml'
            ? `${baseUrl}/api/auth/saml/init?tenantId=${encodeURIComponent(tenantId)}&id=${encodeURIComponent(provider.id)}`
            : `${baseUrl}/api/auth/oidc/init?tenantId=${encodeURIComponent(tenantId)}&id=${encodeURIComponent(provider.id)}`;
        providers.push({
          id: provider.id,
          name: provider.name,
          protocol: provider.protocol,
          enabled: provider.enabled !== false,
          domain: provider.allowedDomains?.[0],
          loginUrl,
          global: false,
        });
      }
    }
  } catch {
    // Best-effort: ignore tenant config errors
  }

  return createSuccessResponse(ctx, { providers });
}
