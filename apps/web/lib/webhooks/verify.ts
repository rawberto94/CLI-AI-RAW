/**
 * Webhook signature verification helper.
 *
 * Counterpart to the HMAC-SHA256 signing performed in `apps/web/lib/webhooks/delivery.ts`.
 * Consumers (including our own internal services that wire one Contigo tenant to another)
 * can import this module to verify the `X-Webhook-Signature` header in constant time
 * against the raw request body.
 *
 * Usage:
 *
 *   import { verifyWebhookSignature } from '@/lib/webhooks/verify';
 *
 *   const ok = verifyWebhookSignature({
 *     signatureHeader: req.headers.get('x-webhook-signature'),
 *     rawBody: rawBodyBuffer, // exact bytes; do not JSON.parse first
 *     secret: process.env.CONTIGO_WEBHOOK_SECRET!,
 *   });
 */

import crypto from 'crypto';

export interface VerifyInput {
  signatureHeader: string | null | undefined;
  rawBody: Buffer | string;
  secret: string;
}

/**
 * Constant-time HMAC-SHA256 signature check. Returns false for any malformed
 * input rather than throwing, so callers can wire this directly into a
 * boolean guard.
 */
export function verifyWebhookSignature({ signatureHeader, rawBody, secret }: VerifyInput): boolean {
  if (!signatureHeader || !secret) return false;
  const sig = signatureHeader.trim();
  if (!/^[a-f0-9]+$/i.test(sig)) return false;

  const bodyBuf = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expectedHex = crypto.createHmac('sha256', secret).update(bodyBuf).digest('hex');

  if (sig.length !== expectedHex.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig.toLowerCase(), 'hex'),
      Buffer.from(expectedHex, 'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Convenience: verify against a Next.js / Web `Request` object whose body
 * has not yet been consumed. Returns the verified body string, or `null`
 * on signature failure.
 */
export async function verifyWebhookRequest(
  request: Request,
  secret: string,
): Promise<string | null> {
  const sig = request.headers.get('x-webhook-signature');
  const raw = await request.text();
  return verifyWebhookSignature({ signatureHeader: sig, rawBody: raw, secret }) ? raw : null;
}
