/**
 * Office SSO Token Exchange API
 *
 * Receives the bootstrap token from Office.auth.getAccessToken(),
 * validates it with Azure AD using the on-behalf-of (OBO) flow,
 * and returns a ConTigo session JWT.
 *
 * The bootstrap token is a v2.0 JWT issued by Microsoft identity platform
 * with audience = api://{addin-domain}/{client-id}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET;
const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID || 'common';

if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET or NEXTAUTH_SECRET must be configured');
}

/**
 * Decode the Office bootstrap token to extract user claims without
 * full OIDC validation (the OBO flow below handles proper validation).
 */
function decodeBootstrapToken(token: string): { preferred_username?: string; name?: string; oid?: string; tid?: string } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { officeToken } = body;

    if (!officeToken) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TOKEN', message: 'Office token is required' } },
        { status: 400 }
      );
    }

    // --- Step 1: Extract user identity from the bootstrap token ---
    const claims = decodeBootstrapToken(officeToken);
    if (!claims?.preferred_username) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Cannot read user identity from Office token' } },
        { status: 401 }
      );
    }

    const email = claims.preferred_username.toLowerCase();
    const displayName = claims.name || email;

    // --- Step 2: Validate the token via Azure AD OBO flow ---
    // Production MUST validate via OBO. Without it we'd be trusting unsigned
    // JWT claims — anyone who can craft a base64-url JSON blob could assume
    // any email identity. Fail closed.
    const oboConfigured = Boolean(AZURE_AD_CLIENT_ID && AZURE_AD_CLIENT_SECRET);
    if (!oboConfigured && process.env.NODE_ENV === 'production') {
      logger.error('[Office SSO] AZURE_AD_CLIENT_ID/SECRET not configured in production — refusing to trust bootstrap token');
      return NextResponse.json(
        { success: false, error: { code: 'SSO_NOT_CONFIGURED', message: 'Microsoft SSO is not configured on this server' } },
        { status: 503 }
      );
    }

    if (oboConfigured) {
      try {
        const tokenEndpoint = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;
        const oboParams = new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          client_id: AZURE_AD_CLIENT_ID as string,
          client_secret: AZURE_AD_CLIENT_SECRET as string,
          assertion: officeToken,
          scope: 'https://graph.microsoft.com/User.Read',
          requested_token_use: 'on_behalf_of',
        });

        const oboResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: oboParams.toString(),
        });

        if (!oboResponse.ok) {
          const oboError = await oboResponse.json().catch(() => ({}));

          // Check for consent_required — tell the client to ask for admin consent
          if (oboError.error === 'interaction_required' || oboError.error === 'consent_required') {
            return NextResponse.json(
              { success: false, error: { code: 'CONSENT_REQUIRED', message: 'Admin consent required for Microsoft SSO' } },
              { status: 403 }
            );
          }

          logger.error('OBO token exchange failed:', oboError);
          return NextResponse.json(
            { success: false, error: { code: 'OBO_FAILED', message: 'Microsoft token validation failed' } },
            { status: 401 }
          );
        }

        // OBO succeeded — token is valid. We can optionally call Graph here for profile,
        // but we already have email/name from the bootstrap token claims.
      } catch (oboErr) {
        logger.error('OBO fetch error:', oboErr);
        return NextResponse.json(
          { success: false, error: { code: 'OBO_ERROR', message: 'Failed to validate Microsoft token' } },
          { status: 500 }
        );
      }
    } else {
      // Development-only: OBO creds missing and NODE_ENV !== 'production'.
      // We trust the unsigned bootstrap claims for local dev iteration.
      logger.warn('[Office SSO] OBO creds missing — trusting bootstrap claims (dev mode only)');
    }

    // --- Step 3: Find or create the user in ConTigo ---
    let user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      // Auto-provision: create a new tenant and user for this Microsoft account
      const nameParts = displayName.split(' ');
      const firstName = nameParts[0] || displayName;
      const lastName = nameParts.slice(1).join(' ') || undefined;

      const tenant = await prisma.tenant.create({
        data: {
          name: `${firstName}'s Organisation`,
          slug: email.replace(/[@.]/g, '-').substring(0, 50),
        },
      });

      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          tenantId: tenant.id,
          role: 'admin',
          emailVerified: true,  // Microsoft-verified email
        },
        include: { tenant: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_ERROR', message: 'Failed to find or create user' } },
        { status: 500 }
      );
    }

    // Enforce the same account-state gates as the credentials flow.
    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: { code: 'ACCOUNT_INACTIVE', message: 'Account is not active' } },
        { status: 403 }
      );
    }
    // MFA cannot be completed in the Office add-in flow. Force browser login.
    if (user.mfaEnabled) {
      return NextResponse.json(
        { success: false, error: { code: 'MFA_REQUIRED', message: 'Multi-factor authentication is enabled. Please sign in through the browser.' } },
        { status: 403 }
      );
    }

    const primaryTenant = user.tenant;
    if (!primaryTenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TENANT', message: 'User has no associated tenant' } },
        { status: 403 }
      );
    }

    // --- Step 4: Issue ConTigo session JWT ---
    const contigoToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        tenantId: primaryTenant.id,
        source: 'office-sso',
      },
      JWT_SECRET as string,
      { expiresIn: '7d' }
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: primaryTenant.id,
        userId: user.id,
        action: 'auth.office_sso',
        resource: 'word-addin',
        details: {
          source: 'office-sso',
          microsoftOid: claims.oid || null,
          ip: req.headers.get('x-forwarded-for') || 'unknown',
        },
      },
    }).catch(() => {
      // Non-critical — don't fail login if audit logging fails
    });

    return NextResponse.json({
      success: true,
      data: {
        token: contigoToken,
        tenantId: primaryTenant.id,
        user: {
          id: user.id,
          name: user.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user.email,
          email: user.email,
        },
      },
    });
  } catch (error) {
    logger.error('Office SSO exchange error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'SSO authentication failed' } },
      { status: 500 }
    );
  }
}
