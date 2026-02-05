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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return redirectWithError(`Authentication failed: ${errorDescription || error}`);
    }

    if (!code) {
      return redirectWithError('No authorization code received');
    }

    // Parse state to get sourceId
    let sourceId: string;
    let tenantId: string;
    
    try {
      const stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
      sourceId = stateData.sourceId;
      tenantId = stateData.tenantId;
    } catch {
      return redirectWithError('Invalid state parameter');
    }

    // Get the source
    const source = await prisma.contractSource.findFirst({
      where: { id: sourceId, tenantId },
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

    // Update the source with tokens
    await prisma.contractSource.update({
      where: { id: sourceId },
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
    console.error('OAuth callback error:', error);
    return redirectWithError(
      error instanceof Error ? error.message : 'Authentication failed'
    );
  }
}

function redirectWithError(message: string): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const encodedError = encodeURIComponent(message);
  return NextResponse.redirect(
    new URL(`/settings/integrations/sources?error=${encodedError}`, appUrl)
  );
}
