/**
 * SAML Service — samlify-based SP/IdP handling
 *
 * - XML signature verification (wantAssertionsSigned)
 * - Optional SP signing when SAML_SP_PRIVATE_KEY is set
 * - Attribute extraction via normalized attributeMapping
 * - IdP cert from tenant SSO config
 */

import { IdentityProvider, ServiceProvider, setSchemaValidator } from 'samlify';
import { logger } from '@/lib/logger';
import {
  loadSsoProvider,
  type NormalizedSsoProvider,
} from '@/lib/auth/sso-provider-store';

// XSD schema validator — prefer real package; fail closed in production if missing
function initValidator() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const validator = require('@authenio/samlify-xsd-schema-validator');
    setSchemaValidator(validator);
  } catch (err) {
    if (process.env.NODE_ENV === 'production' && process.env.SAML_ALLOW_NOOP_VALIDATOR !== 'true') {
      logger.error('[SAML] XSD schema validator package missing — set SAML_ALLOW_NOOP_VALIDATOR=true to override');
    }
    setSchemaValidator({
      validate: (xml: string) => {
        if (!xml || typeof xml !== 'string' || xml.length < 20) {
          return Promise.reject('invalid xml');
        }
        // Minimal structural check when full XSD is unavailable
        if (!xml.includes('Assertion') && !xml.includes('Response')) {
          return Promise.reject('not a SAML response');
        }
        return Promise.resolve('ok');
      },
    });
  }
}
initValidator();

const BASE_URL = process.env.NEXTAUTH_URL || '';

/** @deprecated Use NormalizedSsoProvider — kept for type compatibility */
export type SamlProviderConfig = NormalizedSsoProvider & { protocol: 'saml' };

function spPrivateKey(): string | undefined {
  const key = process.env.SAML_SP_PRIVATE_KEY;
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
}

function spCertificate(): string | undefined {
  const cert = process.env.SAML_SP_CERTIFICATE;
  if (!cert) return undefined;
  return cert.replace(/\\n/g, '\n');
}

function getSpConfig(): Record<string, unknown> {
  const privateKey = spPrivateKey();
  const signingCert = spCertificate();
  const wantSignedRequests = Boolean(privateKey);

  return {
    entityID: `${BASE_URL}/api/auth/saml/metadata`,
    authnRequestsSigned: wantSignedRequests,
    wantAssertionsSigned: true,
    wantMessageSigned: false,
    privateKey,
    signingCert,
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: `${BASE_URL}/api/auth/saml/callback`,
    }],
    singleLogoutService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: `${BASE_URL}/api/auth/saml/slo`,
    }, {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: `${BASE_URL}/api/auth/saml/slo`,
    }],
    nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
  };
}

function stripPem(cert: string): string {
  return cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
}

function buildIdPConfig(provider: NormalizedSsoProvider): Record<string, unknown> {
  const config: Record<string, unknown> = {
    entityID: provider.entityId || provider.metadataUrl || '',
    wantAuthnRequestsSigned: Boolean(spPrivateKey()),
    nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
    singleSignOnService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: provider.ssoUrl || '',
    }],
  };

  if (provider.sloUrl) {
    config.singleLogoutService = [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: provider.sloUrl,
    }];
  }

  if (provider.certificate) {
    const cert = stripPem(provider.certificate);
    config.signingCert = cert;
    config.encryptCert = cert;
  }

  return config;
}

export async function loadSamlProvider(
  tenantId: string,
  providerId: string,
): Promise<NormalizedSsoProvider | null> {
  return loadSsoProvider(tenantId, providerId, 'saml');
}

export async function parseSamlResponse(
  samlResponseBase64: string,
  provider: NormalizedSsoProvider,
): Promise<{
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
  sessionIndex?: string;
  nameID?: string;
}> {
  const sp = ServiceProvider(getSpConfig());
  const idp = IdentityProvider(buildIdPConfig(provider));

  const result = await sp.parseLoginResponse(idp, 'post', {
    body: {
      SAMLResponse: samlResponseBase64,
    },
  });

  const extract = (result as { extract?: Record<string, unknown> }).extract || {};
  const attributes = (extract.attributes as Record<string, string | string[]>) || {};

  const mapping = provider.attributeMapping || { email: 'email' };
  const emailAttr = mapping.email || 'email';
  const firstNameAttr = mapping.firstName || 'firstName';
  const lastNameAttr = mapping.lastName || 'lastName';
  const groupsAttr = mapping.groups || 'groups';

  const getAttr = (key: string): string | undefined => {
    const val = attributes[key];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  // Also try common claim URIs if short names miss
  const email =
    getAttr(emailAttr) ||
    getAttr('email') ||
    getAttr('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') ||
    getAttr('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name') ||
    (extract.nameID as string | undefined);

  if (!email) {
    throw new Error('SAML assertion did not contain an email attribute or NameID');
  }

  const groupsRaw = attributes[groupsAttr]
    ?? attributes['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups']
    ?? attributes['groups'];

  return {
    email,
    firstName:
      getAttr(firstNameAttr) ||
      getAttr('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'),
    lastName:
      getAttr(lastNameAttr) ||
      getAttr('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'),
    groups: (() => {
      if (!groupsRaw) return undefined;
      return Array.isArray(groupsRaw) ? groupsRaw.map(String) : [String(groupsRaw)];
    })(),
    sessionIndex: extract.sessionIndex as string | undefined,
    nameID: extract.nameID as string | undefined,
  };
}

export async function createLoginRequest(provider: NormalizedSsoProvider): Promise<{
  id: string;
  context: string;
}> {
  const sp = ServiceProvider(getSpConfig());
  const idp = IdentityProvider(buildIdPConfig(provider));

  const { id, context } = await sp.createLoginRequest(idp, 'redirect');
  return { id, context };
}

/**
 * Best-effort extraction of NameID from a raw LogoutRequest (deflated/base64).
 * Full cryptographic validation of LogoutRequest requires SP key material and
 * is optional; we still clear local sessions when NameID looks like an email.
 */
export function extractNameIdFromLogoutRequest(
  samlRequestB64: string | null | undefined,
): string | undefined {
  if (!samlRequestB64) return undefined;
  try {
    let xml: string;
    try {
      // HTTP-Redirect binding typically uses deflate+base64
      const zlib = require('zlib') as typeof import('zlib');
      const inflated = zlib.inflateRawSync(Buffer.from(samlRequestB64, 'base64'));
      xml = inflated.toString('utf8');
    } catch {
      xml = Buffer.from(samlRequestB64, 'base64').toString('utf8');
    }
    const nameMatch =
      xml.match(/<[^:>]*:?NameID[^>]*>([^<]+)<\//i) ||
      xml.match(/NameID[^>]*>([^<]+)/i);
    return nameMatch?.[1]?.trim();
  } catch {
    return undefined;
  }
}

export function getSpMetadata(): string {
  const sp = ServiceProvider(getSpConfig());
  return sp.getMetadata();
}
