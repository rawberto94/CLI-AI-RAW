/**
 * Portal Token Validation API
 * Validates HMAC-signed magic link tokens for supplier portal access
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

interface TokenPayload {
  sid: string; // Supplier ID
  tid: string; // Tenant ID
  exp: number; // Expiration timestamp
  cid?: string; // Contract ID (optional - for contract-specific links)
  email?: string; // Supplier email
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: { code: 'MISSING_TOKEN', message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Decode and verify HMAC signature
    let payload: TokenPayload;
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const dotIndex = decoded.lastIndexOf('.');
      if (dotIndex === -1) {
        return NextResponse.json(
          { error: { code: 'INVALID_TOKEN', message: 'Token format is invalid' } },
          { status: 401 }
        );
      }

      const payloadStr = decoded.substring(0, dotIndex);
      const signature = decoded.substring(dotIndex + 1);

      // Verify HMAC signature
      const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '';
      const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        return NextResponse.json(
          { error: { code: 'INVALID_TOKEN', message: 'Token signature is invalid' } },
          { status: 401 }
        );
      }

      payload = JSON.parse(payloadStr);
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Token format is invalid' } },
        { status: 401 }
      );
    }

    // Check expiration
    if (!payload.exp || Date.now() > payload.exp) {
      return NextResponse.json(
        { error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' } },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!payload.tid) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Token is missing required tenant information' } },
        { status: 401 }
      );
    }

    // Return validated token info
    return NextResponse.json({
      success: true,
      data: {
        supplierId: payload.sid || 'unknown',
        tenantId: payload.tid,
        contractId: payload.cid || null,
        email: payload.email || null,
        expiresAt: new Date(payload.exp).toISOString(),
      },
    });
  } catch (error) {
    logger.error('Token validation error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Token validation failed' } },
      { status: 500 }
    );
  }
}
