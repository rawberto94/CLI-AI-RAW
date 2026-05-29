/**
 * SAML Token Validation API
 * POST /api/auth/saml/validate
 *
 * Internal API used by NextAuth credentials provider to validate
 * SAML exchange tokens.
 */

import { NextRequest } from 'next/server';
import { samlTokenStore } from '@/lib/auth/saml-token-store';
import { createSuccessResponse, createErrorResponse, getPublicApiContext } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = getPublicApiContext(request);
  try {
    const body = await request.json();
    const token = body.token as string | undefined;

    if (!token) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Token required', 400);
    }

    const data = samlTokenStore.get(token);
    if (!data) {
      return createSuccessResponse(ctx, { valid: false, reason: 'Token not found or expired' });
    }

    // Consume token (one-time use)
    samlTokenStore.delete(token);

    return createSuccessResponse(ctx, {
      valid: true,
      email: data.email,
      name: data.name,
      tenantId: data.tenantId,
      role: data.role,
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Validation failed', 500);
  }
}
