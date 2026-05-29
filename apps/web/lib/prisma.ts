// IMPORTANT:
// Use the shared Prisma client from the monorepo db package so that
// schema/models/types stay consistent across apps and workers.
//
// NOTE: This module should only be used in server-side code (API routes, 
// server components, server actions). Do not import directly in client components.
// For client-side code, use API routes or server actions instead.

import getClient, { PrismaClient } from '@repo/db';
import { DatabaseSecurityService, createRLSMiddleware } from '@/lib/security/database-security';
import { validateDataRegion, getComplianceStatus } from '@/lib/swiss-compliance';

export const prisma: PrismaClient = getClient();

// Attach Row-Level Security middleware for multi-tenant isolation
const dbSecurity = new DatabaseSecurityService(prisma);
prisma.$use(createRLSMiddleware(dbSecurity) as any);

// ============================================================================
// Swiss Compliance Runtime Validation
// ============================================================================

function runComplianceChecks() {
  const region = process.env.DATA_REGION || process.env.AZURE_REGION || 'unknown';
  const isRegionValid = validateDataRegion(region);
  const status = getComplianceStatus();

  if (!isRegionValid) {
    console.error(`[COMPLIANCE] CRITICAL: Data region '${region}' is not in the Swiss compliance allowlist. ` +
      `Allowed: switzerland, ch-zurich, ch-geneva, eu-central-1, europe-west6, switzerlandnorth, westeurope. ` +
      `Deployments in non-compliant regions violate Swiss FADP requirements.`);
  }

  if (status.issues.length > 0) {
    console.warn(`[COMPLIANCE] Issues detected: ${status.issues.join('; ')}`);
  }

  // Validate Azure OpenAI deployment is not GlobalStandard
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
  if (azureOpenAiEndpoint.includes('global') || azureOpenAiEndpoint.includes('openai.azure.com')) {
    // global.azure-api.net or bare openai.azure.com indicate GlobalStandard
    if (!azureOpenAiEndpoint.includes('switzerlandnorth') && !azureOpenAiEndpoint.includes('westeurope')) {
      console.warn(`[COMPLIANCE] AZURE_OPENAI_ENDPOINT may be using a GlobalStandard deployment. ` +
        `Use a regional endpoint (e.g., switzerlandnorth) to ensure data residency.`);
    }
  }

  // Validate Key Vault is not publicly accessible (best-effort env check)
  if (process.env.AZURE_KEY_VAULT_PUBLIC_NETWORK_ACCESS === 'Enabled') {
    console.error(`[COMPLIANCE] CRITICAL: Azure Key Vault public network access is enabled. ` +
      `Disable public access and use private endpoints.`);
  }
}

// Run checks once at module load (server-side only)
if (typeof window === 'undefined') {
  try {
    runComplianceChecks();
  } catch {
    // Non-blocking: compliance checks must not crash the app
  }
}

export async function getDb(): Promise<PrismaClient> {
  return prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function getConnectionStats() {
  try {
    const result = await prisma.$queryRaw<
      Array<{
        total_connections: number;
        active_connections: number;
        idle_connections: number;
      }>
    >`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    return result[0] ?? null;
  } catch {
    return null;
  }
}

// Default export - getDb for routes that import like `import getDb from '@/lib/prisma'`
export default getDb;
