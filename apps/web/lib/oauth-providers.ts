/**
 * OAuth Provider Configurations for Third-Party Integrations
 * DocuSign, SAP Ariba, Coupa, Adobe Sign, HelloSign
 */

// Define our own OAuthConfig type since the import from next-auth varies by version
interface UserinfoEndpoint<Profile> {
  url: string;
  request?: (context: { tokens: { access_token: string }; provider: { userinfo?: { url: string } } }) => Promise<Profile>;
}

interface OAuthConfig<Profile> {
  id: string;
  name: string;
  type: 'oauth' | 'oidc';
  authorization: {
    url: string;
    params?: Record<string, string>;
  };
  token: string;
  userinfo?: string | UserinfoEndpoint<Profile>;
  clientId: string;
  clientSecret: string;
  profile?: (profile: Profile) => {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

// =====================
// DocuSign OAuth Provider
// =====================

export const DocuSignProvider: OAuthConfig<{
  sub: string;
  name: string;
  email: string;
  accounts: Array<{ account_id: string; account_name: string; is_default: boolean }>;
}> = {
  id: 'docusign',
  name: 'DocuSign',
  type: 'oauth',
  authorization: {
    url: process.env.DOCUSIGN_ENV === 'production' 
      ? 'https://account.docusign.com/oauth/auth'
      : 'https://account-d.docusign.com/oauth/auth',
    params: {
      scope: 'signature impersonation extended',
      response_type: 'code',
    },
  },
  token: process.env.DOCUSIGN_ENV === 'production'
    ? 'https://account.docusign.com/oauth/token'
    : 'https://account-d.docusign.com/oauth/token',
  userinfo: process.env.DOCUSIGN_ENV === 'production'
    ? 'https://account.docusign.com/oauth/userinfo'
    : 'https://account-d.docusign.com/oauth/userinfo',
  profile(profile) {
    const defaultAccount = profile.accounts?.find(a => a.is_default) || profile.accounts?.[0];
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      accountId: defaultAccount?.account_id,
      accountName: defaultAccount?.account_name,
    };
  },
  clientId: process.env.DOCUSIGN_CLIENT_ID || '',
  clientSecret: process.env.DOCUSIGN_CLIENT_SECRET || '',
};

// =====================
// SAP Ariba OAuth Provider
// =====================

export const SAPAribaProvider: OAuthConfig<{
  user_id: string;
  user_name: string;
  email: string;
  realm: string;
}> = {
  id: 'sap-ariba',
  name: 'SAP Ariba',
  type: 'oauth',
  authorization: {
    url: `https://${process.env.SAP_ARIBA_REALM}.authentication.${process.env.SAP_ARIBA_REGION || 'us10'}.hana.ondemand.com/oauth/authorize`,
    params: {
      scope: 'openid',
      response_type: 'code',
    },
  },
  token: `https://${process.env.SAP_ARIBA_REALM}.authentication.${process.env.SAP_ARIBA_REGION || 'us10'}.hana.ondemand.com/oauth/token`,
  userinfo: `https://${process.env.SAP_ARIBA_REALM}.authentication.${process.env.SAP_ARIBA_REGION || 'us10'}.hana.ondemand.com/userinfo`,
  profile(profile) {
    return {
      id: profile.user_id,
      name: profile.user_name,
      email: profile.email,
      realm: profile.realm,
    };
  },
  clientId: process.env.SAP_ARIBA_CLIENT_ID || '',
  clientSecret: process.env.SAP_ARIBA_CLIENT_SECRET || '',
};

// =====================
// Coupa OAuth Provider
// =====================

export const CoupaProvider: OAuthConfig<{
  id: number;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
}> = {
  id: 'coupa',
  name: 'Coupa',
  type: 'oauth',
  authorization: {
    url: `https://${process.env.COUPA_INSTANCE}.coupahost.com/oauth2/authorize`,
    params: {
      scope: 'core.contracts.read core.contracts.write core.common.read',
      response_type: 'code',
    },
  },
  token: `https://${process.env.COUPA_INSTANCE}.coupahost.com/oauth2/token`,
  userinfo: {
    url: `https://${process.env.COUPA_INSTANCE}.coupahost.com/api/users/me`,
    async request({ tokens, provider }) {
      const response = await fetch(provider.userinfo?.url as string, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      });
      return response.json();
    },
  },
  profile(profile) {
    return {
      id: String(profile.id),
      name: `${profile.firstname} ${profile.lastname}`.trim() || profile.login,
      email: profile.email,
    };
  },
  clientId: process.env.COUPA_CLIENT_ID || '',
  clientSecret: process.env.COUPA_CLIENT_SECRET || '',
};

// =====================
// Adobe Sign OAuth Provider
// =====================

export const AdobeSignProvider: OAuthConfig<{
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}> = {
  id: 'adobe-sign',
  name: 'Adobe Sign',
  type: 'oauth',
  authorization: {
    url: 'https://secure.na1.adobesign.com/public/oauth/v2',
    params: {
      scope: 'agreement_read agreement_write agreement_send user_read',
      response_type: 'code',
    },
  },
  token: 'https://api.na1.adobesign.com/oauth/v2/token',
  userinfo: 'https://api.na1.adobesign.com/api/rest/v6/users/me',
  profile(profile) {
    return {
      id: profile.userId,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      email: profile.email,
    };
  },
  clientId: process.env.ADOBE_SIGN_CLIENT_ID || '',
  clientSecret: process.env.ADOBE_SIGN_CLIENT_SECRET || '',
};

// =====================
// HelloSign (Dropbox Sign) OAuth Provider
// =====================

export const HelloSignProvider: OAuthConfig<{
  account_id: string;
  email_address: string;
}> = {
  id: 'hellosign',
  name: 'HelloSign',
  type: 'oauth',
  authorization: {
    url: 'https://app.hellosign.com/oauth/authorize',
    params: {
      scope: 'basic_account_info signature_request_access',
      response_type: 'code',
    },
  },
  token: 'https://app.hellosign.com/oauth/token',
  userinfo: {
    url: 'https://api.hellosign.com/v3/account',
    async request({ tokens }) {
      const response = await fetch('https://api.hellosign.com/v3/account', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      const data = await response.json();
      return data.account;
    },
  },
  profile(profile) {
    return {
      id: profile.account_id,
      email: profile.email_address,
      name: profile.email_address.split('@')[0],
    };
  },
  clientId: process.env.HELLOSIGN_CLIENT_ID || '',
  clientSecret: process.env.HELLOSIGN_CLIENT_SECRET || '',
};

// =====================
// OAuth Provider Types
// =====================

export interface OAuthProvider {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  scopes: string[];
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
}

// All available OAuth providers for integration hub
export const oauthProviders: Record<string, OAuthProvider> = {
  docusign: {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Electronic signature and agreement platform',
    scopes: ['signature', 'impersonation', 'extended'],
    authorizationUrl: process.env.DOCUSIGN_ENV === 'production'
      ? 'https://account.docusign.com/oauth/auth'
      : 'https://account-d.docusign.com/oauth/auth',
    clientId: process.env.DOCUSIGN_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/docusign`
      : 'http://localhost:3000/api/auth/callback/docusign',
  },
  'sap-ariba': {
    id: 'sap-ariba',
    name: 'SAP Ariba',
    description: 'Procurement and supply chain management',
    scopes: ['openid'],
    authorizationUrl: process.env.SAP_ARIBA_REALM 
      ? `https://api.ariba.com/v2/oauth/authorize/${process.env.SAP_ARIBA_REALM}`
      : 'https://api.ariba.com/v2/oauth/authorize',
    clientId: process.env.SAP_ARIBA_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/sap-ariba`
      : 'http://localhost:3000/api/auth/callback/sap-ariba',
  },
  coupa: {
    id: 'coupa',
    name: 'Coupa',
    description: 'Business spend management platform',
    scopes: ['core.contracts.read', 'core.contracts.write'],
    authorizationUrl: process.env.COUPA_INSTANCE_URL 
      ? `${process.env.COUPA_INSTANCE_URL}/oauth2/authorize`
      : 'https://your-instance.coupahost.com/oauth2/authorize',
    clientId: process.env.COUPA_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/coupa`
      : 'http://localhost:3000/api/auth/callback/coupa',
  },
  'adobe-sign': {
    id: 'adobe-sign',
    name: 'Adobe Sign',
    description: 'Electronic signature and document workflows',
    scopes: ['agreement_read', 'agreement_write', 'agreement_send'],
    authorizationUrl: 'https://secure.na1.adobesign.com/public/oauth/v2',
    clientId: process.env.ADOBE_SIGN_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/adobe-sign`
      : 'http://localhost:3000/api/auth/callback/adobe-sign',
  },
  hellosign: {
    id: 'hellosign',
    name: 'HelloSign (Dropbox Sign)',
    description: 'Signature requests and document signing',
    scopes: ['basic_account_info', 'signature_request_access'],
    authorizationUrl: 'https://app.hellosign.com/oauth/authorize',
    clientId: process.env.HELLOSIGN_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/hellosign`
      : 'http://localhost:3000/api/auth/callback/hellosign',
  },
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '📁',
    description: 'Import documents from Google Drive',
    scopes: ['drive.readonly', 'drive.file', 'userinfo.email'],
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-drive`
      : 'http://localhost:3000/api/auth/callback/google-drive',
  },
  'sharepoint': {
    id: 'sharepoint',
    name: 'SharePoint / OneDrive',
    icon: '📂',
    description: 'Import documents from Microsoft 365',
    scopes: ['Files.Read', 'Files.ReadWrite', 'User.Read'],
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/sharepoint`
      : 'http://localhost:3000/api/auth/callback/sharepoint',
  },
  'dropbox': {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    description: 'Import documents from Dropbox',
    scopes: ['files.metadata.read', 'files.content.read'],
    authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
    clientId: process.env.DROPBOX_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/dropbox`
      : 'http://localhost:3000/api/auth/callback/dropbox',
  },
  'box': {
    id: 'box',
    name: 'Box',
    icon: '📋',
    description: 'Import documents from Box',
    scopes: ['root_readonly'],
    authorizationUrl: 'https://account.box.com/api/oauth2/authorize',
    clientId: process.env.BOX_CLIENT_ID || '',
    redirectUri: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/box`
      : 'http://localhost:3000/api/auth/callback/box',
  },
};

// =====================
// Provider Factory
// =====================

export function getIntegrationProviders() {
  const providers: OAuthConfig<any>[] = [];
  
  if (process.env.DOCUSIGN_CLIENT_ID) {
    providers.push(DocuSignProvider);
  }
  
  if (process.env.SAP_ARIBA_CLIENT_ID) {
    providers.push(SAPAribaProvider);
  }
  
  if (process.env.COUPA_CLIENT_ID) {
    providers.push(CoupaProvider);
  }
  
  if (process.env.ADOBE_SIGN_CLIENT_ID) {
    providers.push(AdobeSignProvider);
  }
  
  if (process.env.HELLOSIGN_CLIENT_ID) {
    providers.push(HelloSignProvider);
  }
  
  return providers;
}

// =====================
// Token Refresh Helper
// =====================

export async function refreshOAuthToken(
  provider: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  const providerConfig = {
    docusign: {
      tokenUrl: process.env.DOCUSIGN_ENV === 'production'
        ? 'https://account.docusign.com/oauth/token'
        : 'https://account-d.docusign.com/oauth/token',
      clientId: process.env.DOCUSIGN_CLIENT_ID,
      clientSecret: process.env.DOCUSIGN_CLIENT_SECRET,
    },
    'sap-ariba': {
      tokenUrl: `https://${process.env.SAP_ARIBA_REALM}.authentication.${process.env.SAP_ARIBA_REGION || 'us10'}.hana.ondemand.com/oauth/token`,
      clientId: process.env.SAP_ARIBA_CLIENT_ID,
      clientSecret: process.env.SAP_ARIBA_CLIENT_SECRET,
    },
    coupa: {
      tokenUrl: `https://${process.env.COUPA_INSTANCE}.coupahost.com/oauth2/token`,
      clientId: process.env.COUPA_CLIENT_ID,
      clientSecret: process.env.COUPA_CLIENT_SECRET,
    },
    'adobe-sign': {
      tokenUrl: 'https://api.na1.adobesign.com/oauth/v2/refresh',
      clientId: process.env.ADOBE_SIGN_CLIENT_ID,
      clientSecret: process.env.ADOBE_SIGN_CLIENT_SECRET,
    },
    hellosign: {
      tokenUrl: 'https://app.hellosign.com/oauth/token',
      clientId: process.env.HELLOSIGN_CLIENT_ID,
      clientSecret: process.env.HELLOSIGN_CLIENT_SECRET,
    },
  };

  const config = providerConfig[provider as keyof typeof providerConfig];
  if (!config) return null;

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    };
  } catch {
    return null;
  }
}
