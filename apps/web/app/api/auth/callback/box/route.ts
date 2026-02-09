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

export const GET = withApiHandler(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Box OAuth error:', error, errorDescription);
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
      } catch {
        console.warn('Failed to parse OAuth state');
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
    console.error('Box OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.redirect(
      new URL(`/settings/contract-sources?error=${encodeURIComponent(message)}`, request.url)
    );
  }
});
