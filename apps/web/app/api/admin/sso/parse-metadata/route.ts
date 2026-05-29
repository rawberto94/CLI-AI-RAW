import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { parseStringPromise } from 'xml2js';

export const runtime = 'nodejs';

function getFirst(obj: any): any {
  if (Array.isArray(obj)) return getFirst(obj[0]);
  return obj;
}

function extractText(node: any): string {
  if (typeof node === 'string') return node;
  if (node && node._) return node._;
  if (Array.isArray(node)) return extractText(node[0]);
  return '';
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const { metadata } = body;

  if (!metadata || typeof metadata !== 'string') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'metadata XML string is required', 400);
  }

  try {
    const parsed = await parseStringPromise(metadata, { explicitArray: false, xmlns: true });
    const root = parsed['md:EntityDescriptor'] || parsed['EntityDescriptor'];
    if (!root) {
      return createErrorResponse(ctx, 'PARSE_ERROR', 'Could not find EntityDescriptor in metadata', 400);
    }

    const entityId = root.$?.entityID || root.$?.['xmlns:md']?.$?.entityID || '';

    const idpDescriptor =
      root['md:IDPSSODescriptor'] ||
      root['IDPSSODescriptor'];

    if (!idpDescriptor) {
      return createErrorResponse(ctx, 'PARSE_ERROR', 'Could not find IDPSSODescriptor in metadata', 400);
    }

    const ssoService =
      getFirst(idpDescriptor['md:SingleSignOnService']) ||
      getFirst(idpDescriptor['SingleSignOnService']);
    const ssoUrl = ssoService?.$?.Location || '';

    const sloService =
      getFirst(idpDescriptor['md:SingleLogoutService']) ||
      getFirst(idpDescriptor['SingleLogoutService']);
    const sloUrl = sloService?.$?.Location || '';

    const keyDescriptor =
      getFirst(idpDescriptor['md:KeyDescriptor']) ||
      getFirst(idpDescriptor['KeyDescriptor']);

    const x509Data =
      keyDescriptor?.['md:KeyInfo']?.['ds:X509Data'] ||
      keyDescriptor?.['KeyInfo']?.['X509Data'] ||
      keyDescriptor?.['ds:KeyInfo']?.['ds:X509Data'];

    const certificate =
      extractText(x509Data?.['ds:X509Certificate'] || x509Data?.['X509Certificate'] || '').trim();

    return createSuccessResponse(ctx, {
      entityId,
      ssoUrl,
      sloUrl,
      certificate: certificate ? `-----BEGIN CERTIFICATE-----\n${certificate}\n-----END CERTIFICATE-----` : '',
    });
  } catch (err: any) {
    return createErrorResponse(ctx, 'PARSE_ERROR', `Failed to parse metadata: ${err.message}`, 400);
  }
});
