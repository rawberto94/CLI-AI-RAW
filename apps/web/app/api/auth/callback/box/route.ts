/**
 * Box OAuth Callback Handler
 * 
 * GET /api/auth/callback/box - Handle OAuth callback from Box
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BoxConnector } from '@/lib/integrations/connectors/box.connector';
import { auditTrailService } from 'data-orchestration/services';
import { withApiHandler } from '@/lib/api-middleware';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';

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
      logger.error('Box OAuth error:', error, errorDescription ? { description: errorDescription } : undefined);
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
        logger.warn('Failed to parse OAuth state');
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
    const connector = new BoxConnector({
      type: 'box',
    });

    const tokens = await connector.exchangeCodeForTokens(code);

    // Test connection to get account info
    const tempConnector = new BoxConnector({
      type: 'box',
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
      new URL('/settings/contract-sources?connected=box', request.url)
    );
  } catch (error) {
    logger.error('Box OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/settings/contract-sources?error=${encodeURIComponent(message)}`, request.url)
    );
  }
});
