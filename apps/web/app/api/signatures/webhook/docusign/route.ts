/**
 * DocuSign Connect Webhook Endpoint
 *
 * Receives envelope status updates from DocuSign Connect.
 * Configure in DocuSign Admin > Connect > Add Configuration:
 *   URL: https://your-domain.com/api/signatures/webhook/docusign
 *   Events: Envelope Sent, Delivered, Completed, Declined, Voided
 */

import { NextRequest, NextResponse } from 'next/server';
import { eSignatureService } from '@/lib/esignature/docusign.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // DocuSign sends XML by default, but we configure JSON
    const contentType = request.headers.get('content-type') || '';
    let payload: Record<string, unknown>;

    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      // For XML payloads, we'd need to parse — for now reject
      logger.warn('DocuSign webhook received non-JSON payload');
      return NextResponse.json({ error: 'JSON payloads only' }, { status: 400 });
    }

    // Verify HMAC signature — fail closed if secret not configured
    const hmacHeader = request.headers.get('x-docusign-signature-1');
    const hmacSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    if (!hmacSecret) {
      logger.error('DOCUSIGN_WEBHOOK_SECRET not configured — rejecting all webhooks for security');
      return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 503 });
    }
    if (!hmacHeader) {
      logger.warn('DocuSign webhook missing HMAC signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    {
      const crypto = await import('crypto');
      const computed = crypto
        .createHmac('sha256', hmacSecret)
        .update(JSON.stringify(payload))
        .digest('base64');
      if (computed !== hmacHeader) {
        logger.warn('DocuSign webhook HMAC verification failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Process the webhook
    await eSignatureService.handleWebhook(payload);

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('DocuSign webhook processing failed: ' + String(error));
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
