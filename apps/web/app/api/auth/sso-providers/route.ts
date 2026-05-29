/**
 * Dynamic SSO Providers API
 * GET /api/auth/sso-providers
 *
 * Returns merged list of SSO providers from environment variables
 * and tenant-specific admin configuration.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicApiContext, createSuccessResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

interface SSOProviderInfo {
  id: string;
  name: string;
  protocol: 'oidc' | 'saml';
  enabled: boolean;
  domain?: string;
}

export async function GET(request: NextRequest) {
  const ctx = getPublicApiContext(request);

  const providers: SSOProviderInfo[] = [];

  // Environment-based providers
  if (process.env.GOOGLE_CLIENT_ID) {
    providers.push({ id: 'google', name: 'Google', protocol: 'oidc', enabled: true });
  }
  if (process.env.AZURE_AD_CLIENT_ID) {
    providers.push({ id: 'microsoft-entra-id', name: 'Microsoft Entra ID', protocol: 'oidc', enabled: true });
  }
  if (process.env.GITHUB_CLIENT_ID) {
    providers.push({ id: 'github', name: 'GitHub', protocol: 'oidc', enabled: true });
  }

  // Tenant-specific providers from admin config
  try {
    const tenantId = request.headers.get('x-tenant-id') ||
                     new URL(request.url).searchParams.get('tenantId') ||
                     undefined;

    if (tenantId) {
      const config = await prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { securitySettings: true },
      });

      const securitySettings = (config?.securitySettings || {}) as {
        ssoProviders?: Array<{
          id: string;
          name: string;
          protocol: 'oidc' | 'saml';
          enabled: boolean;
          allowedDomains?: string[];
        }>;
      };

      if (securitySettings.ssoProviders) {
        for (const provider of securitySettings.ssoProviders) {
          // Avoid duplicates
          if (!providers.some(p => p.id === provider.id)) {
            providers.push({
              id: provider.id,
              name: provider.name,
              protocol: provider.protocol,
              enabled: provider.enabled,
              domain: provider.allowedDomains?.[0],
            });
          }
        }
      }
    }
  } catch {
    // Best-effort: ignore tenant config errors
  }

  return createSuccessResponse(ctx, { providers });
}
