/**
 * SharePoint OAuth Callback Handler
 * 
 * Handles the OAuth callback from Microsoft for SharePoint/OneDrive
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies as _cookies } from 'next/headers';
import { SharePointConnector } from '@/lib/integrations/connectors/sharepoint.connector';
import { SharePointCredentials } from '@/lib/integrations/connectors/types';
import { auditTrailService } from 'data-orchestration/services';
import { withApiHandler } from '@/lib/api-middleware';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    // Validate that this callback is being driven by a logged-in user.
    // Without this, an attacker can trigger OAuth at their own IDP and then
    // replay the resulting code+state against this endpoint to attach their
    // tokens to another tenant's ContractSource (cross-tenant credential
    // injection — an attacker's SharePoint would be used as the sync source
    // for a victim tenant, allowing arbitrary PDF ingestion).
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.redirect(
        new URL('/auth/signin?error=session_expired&redirect=/settings/integrations/sources', request.url)
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      logger.error('OAuth error:', error, errorDescription ? { description: errorDescription } : undefined);
      return redirectWithError(`Authentication failed: ${errorDescription || error}`);
    }

    if (!code) {
      return redirectWithError('No authorization code received');
    }

    // Parse state to get sourceId
    let sourceId: string;
    let stateTenantId: string;

    try {
      const stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
      sourceId = stateData.sourceId;
      stateTenantId = stateData.tenantId;
    } catch {
      return redirectWithError('Invalid state parameter');
    }

    // Verify the state's tenantId matches the logged-in session. Prevents
    // an attacker from driving the callback with a state crafted for a
    // different tenant's sourceId.
    if (!stateTenantId || stateTenantId !== session.user.tenantId) {
      logger.warn('[SharePoint OAuth] state tenantId mismatch', {
        stateTenantId,
        sessionTenantId: session.user.tenantId,
      });
      return redirectWithError('Unauthorized: tenant mismatch');
    }

    // Get the source, always scoped to the SESSION's tenantId (not the state's)
    // as a defense-in-depth measure.
    const source = await prisma.contractSource.findFirst({
      where: { id: sourceId, tenantId: session.user.tenantId },
    });

    if (!source) {
      return redirectWithError('Source not found');
    }

    if (!source.credentials) {
      return redirectWithError('Source credentials not configured');
    }

    // Exchange code for tokens
    const credentials = source.credentials as unknown as SharePointCredentials;
    const connector = new SharePointConnector(credentials);
    
    const tokens = await connector.exchangeCodeForTokens(code);

    // Get user info
    connector.setTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
    const connectionTest = await connector.testConnection();

    // Update the source with tokens (tenant-scoped to prevent TOCTOU)
    await prisma.contractSource.updateMany({
      where: { id: sourceId, tenantId: session.user.tenantId },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
        status: 'CONNECTED',
        accountEmail: connectionTest.accountInfo?.email,
        accountName: connectionTest.accountInfo?.name,
        connectedAt: new Date(),
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    });

    await connector.disconnect();

    // Redirect back to the sources page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    return NextResponse.redirect(
      new URL(`/settings/integrations/sources?connected=${sourceId}`, appUrl)
    );
  } catch (error) {
    logger.error('OAuth callback error:', error);
    return redirectWithError(
      error instanceof Error ? error.message : 'Authentication failed'
    );
  }
});

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const encodedError = encodeURIComponent(message);
  return NextResponse.redirect(
    new URL(`/settings/integrations/sources?error=${encodedError}`, appUrl)
  );
}
