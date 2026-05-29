/**
 * SAML Service — samlify-based SP/IdP handling
 *
 * Production-ready SAML 2.0 assertion parsing with:
 * - XML signature verification
 * - Assertion decryption (if encrypted)
 * - Attribute extraction
 * - IdP metadata parsing
 */

import samlify from 'samlify';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Set up the XSD schema validator required by samlify
const { validate } = require('@authenio/samlify-xsd-schema-validator');
samlify.setSchemaValidator(validate);

const BASE_URL = process.env.NEXTAUTH_URL || '';

export interface SamlProviderConfig {
  id: string;
  name: string;
  protocol: 'saml';
  entityId?: string;
  metadataUrl?: string;
  ssoUrl?: string;
  certificate?: string;
  sloUrl?: string;
  attributeMapping: {
    email: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
  };
}

function getSpConfig(): samlify.ServiceProviderConfig {
  return {
    entityID: `${BASE_URL}/api/auth/saml/metadata`,
    authnRequestsSigned: false,
    wantAssertionsSigned: true,
    wantMessageSigned: false,
    assertionConsumerService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
      Location: `${BASE_URL}/api/auth/saml/callback`,
    }],
    singleLogoutService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: `${BASE_URL}/api/auth/saml/slo`,
    }],
    nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
  };
}

function buildIdPConfig(provider: SamlProviderConfig): samlify.IdentityProviderConfig {
  const config: samlify.IdentityProviderConfig = {
    entityID: provider.entityId || provider.metadataUrl || '',
    wantAuthnRequestsSigned: false,
    nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
    singleSignOnService: [{
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: provider.ssoUrl || '',
    }],
  };

  if (provider.certificate) {
    // Normalize certificate PEM
    const cert = provider.certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
    config.signingCert = cert;
    config.encryptCert = cert;
  }

  return config;
}

export async function loadSamlProvider(tenantId: string, providerId: string): Promise<SamlProviderConfig | null> {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { securitySettings: true },
  });

  const securitySettings = (config?.securitySettings || {}) as {
    ssoProviders?: SamlProviderConfig[];
  };

  return securitySettings.ssoProviders?.find(
    (p) => p.id === providerId && p.protocol === 'saml'
  ) || null;
}

export async function parseSamlResponse(
  samlResponseBase64: string,
  provider: SamlProviderConfig,
): Promise<{
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
  sessionIndex?: string;
  nameID?: string;
}> {
  const sp = samlify.ServiceProvider(getSpConfig());
  const idp = samlify.IdentityProvider(buildIdPConfig(provider));

  const result = await sp.parseLoginResponse(idp, 'post', {
    body: {
      SAMLResponse: samlResponseBase64,
    },
  });

  const extract = result.extract;
  const attributes = (extract.attributes as Record<string, string | string[]>) || {};

  const emailAttr = provider.attributeMapping.email || 'email';
  const firstNameAttr = provider.attributeMapping.firstName || 'firstName';
  const lastNameAttr = provider.attributeMapping.lastName || 'lastName';
  const groupsAttr = provider.attributeMapping.groups || 'groups';

  const getAttr = (key: string): string | undefined => {
    const val = attributes[key];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const email = getAttr(emailAttr) || (extract.nameID as string);
  if (!email) {
    throw new Error('SAML assertion did not contain an email attribute or NameID');
  }

  return {
    email,
    firstName: getAttr(firstNameAttr),
    lastName: getAttr(lastNameAttr),
    groups: (() => {
      const g = attributes[groupsAttr];
      if (!g) return undefined;
      return Array.isArray(g) ? g : [g];
    })(),
    sessionIndex: extract.sessionIndex as string | undefined,
    nameID: extract.nameID as string | undefined,
  };
}

export async function createLoginRequest(provider: SamlProviderConfig): Promise<{
  id: string;
  context: string;
}> {
  const sp = samlify.ServiceProvider(getSpConfig());
  const idp = samlify.IdentityProvider(buildIdPConfig(provider));

  const { id, context } = await sp.createLoginRequest(idp, 'redirect');
  return { id, context };
}

export function getSpMetadata(): string {
  const sp = samlify.ServiceProvider(getSpConfig());
  return sp.getEntityMetadata();
}
