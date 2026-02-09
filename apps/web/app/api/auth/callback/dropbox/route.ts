/**
 * Dropbox OAuth Callback Handler
 * 
 * GET /api/auth/callback/dropbox - Handle OAuth callback from Dropbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DropboxConnector } from '@/lib/integrations/connectors/dropbox.connector';
import { auditTrailService } from 'data-orchestration/services';
import { withApiHandler } from '@/lib/api-middleware';
import { auth } from '@/lib/auth';

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    // M15 FIX: Validate user session
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.redirect(
        new URL('/auth/signin?error=session_expired&redirect=/settings/contract-sources', request.url)
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Dropbox OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/settings/contract-sources?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/contract-sources?error=No authorization code received', request.url)
      );
    }

    // Parse state to get sourceId
    let sourceId: string | null = null;
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        sourceId = stateData.sourceId;
        // M15 FIX: Verify tenant ownership
        if (stateData.tenantId && stateData.tenantId !== session.user.tenantId) {
          return NextResponse.redirect(
            new URL('/settings/contract-sources?error=Unauthorized: tenant mismatch', request.url)
          );
        }
      } catch {
        console.warn('Failed to parse OAuth state');
      }
    }

    // M15 FIX: Verify sourceId ownership before update
    if (sourceId) {
      const source = await prisma.contractSource.findFirst({
        where: { id: sourceId, tenantId: session.user.tenantId },
      });
      if (!source) {
        return NextResponse.redirect(
          new URL('/settings/contract-sources?error=Source not found or unauthorized', request.url)
        );
      }
    }

    // Exchange code for tokens
    const connector = new DropboxConnector({
      type: 'dropbox',
    });

    const tokens = await connector.exchangeCodeForTokens(code);

    // Test connection to get account info
    const tempConnector = new DropboxConnector({
      type: 'dropbox',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
    });

    const connectionTest = await tempConnector.testConnection();

    if (!connectionTest.connected) {
      return NextResponse.redirect(
        new URL(`/settings/contract-sources?error=${encodeURIComponent(connectionTest.error || 'Connection failed')}`, request.url)
      );
    }

    // Update the contract source with tokens
    if (sourceId) {
      await prisma.contractSource.update({
        where: { id: sourceId },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: tokens.expiresAt,
          status: 'CONNECTED',
          accountEmail: connectionTest.accountInfo?.email,
          accountName: connectionTest.accountInfo?.name,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });
    }

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/settings/contract-sources?connected=dropbox', request.url)
    );
  } catch (error) {
    console.error('Dropbox OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/settings/contract-sources?error=${encodeURIComponent(message)}`, request.url)
    );
  }
});
