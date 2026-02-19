/**
 * Microsoft SSO Service for Office Add-in
 *
 * Uses the Office.auth.getAccessToken() API to obtain a bootstrap token from
 * the Office host, then exchanges it with the ConTigo backend for a session JWT.
 *
 * Requirements:
 *   - manifest.xml must include <WebApplicationInfo> with the Azure AD app's
 *     Application (client) ID and the api://{addin-domain}/{client-id} scope.
 *   - The Azure AD app registration must expose an "access_as_user" scope and
 *     grant "User.Read", "profile", "openid", "email" delegated permissions.
 *
 * Fallback:
 *   If Office SSO is unavailable (older host, user denial, consent not granted)
 *   we fall back to a MSAL popup flow.
 */

/* global Office, OfficeRuntime */

import { apiClient } from './api-client';

export interface SSOResult {
  success: boolean;
  token?: string;       // ConTigo session JWT (not the MS token)
  tenantId?: string;    // ConTigo tenant
  user?: {
    id: string;
    email: string;
    name: string;
  };
  error?: string;
  needsConsent?: boolean;
}

/**
 * Attempt silent SSO via Office.auth.getAccessToken().
 * Returns the raw bootstrap (access) token from the Office host.
 */
async function getOfficeAccessToken(): Promise<{ token?: string; error?: string; needsFallback?: boolean }> {
  try {
    const accessToken = await Office.auth.getAccessToken({
      allowSignInPrompt: true,
      allowConsentPrompt: true,
      forMSGraphAccess: false,  // We don't call Graph directly; exchange on backend
    });

    return { token: accessToken };
  } catch (err: any) {
    const code = err?.code;

    // Errors that mean SSO is not available — caller should use fallback
    const fallbackCodes = [
      13000, // API not supported in this Office version
      13001, // Not logged into Office
      13002, // Cancelled by user
      13003, // Not supported on this platform
      13005, // GetAccessToken called from wrong context
      13007, // User not signed in (should not happen with allowSignInPrompt)
      13008, // Duplicate getAccessToken call
      13010, // Running in Office on the web in an unsupported browser
      13012, // Runtime doesn't support SSO
    ];

    // Consent-related errors — may require admin consent
    const consentCodes = [
      13004, // Consent not granted by user for this scope
      13006, // Admin consent required
    ];

    if (consentCodes.includes(code)) {
      return { error: 'Admin consent is required for Microsoft SSO.', needsFallback: true };
    }

    if (fallbackCodes.includes(code)) {
      return { error: `Office SSO not available (code ${code}).`, needsFallback: true };
    }

    return { error: err?.message || `SSO error (code ${code})` };
  }
}

/**
 * Exchange the Office bootstrap token with the ConTigo backend.
 * The backend verifies the token with Azure AD and either matches an
 * existing user or auto-provisions one.
 */
async function exchangeTokenWithBackend(officeToken: string): Promise<SSOResult> {
  try {
    const result = await apiClient.exchangeOfficeToken(officeToken);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error?.message || 'SSO exchange failed',
        needsConsent: result.error?.code === 'CONSENT_REQUIRED',
      };
    }

    return {
      success: true,
      token: result.data.token,
      tenantId: result.data.tenantId,
      user: result.data.user,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error during SSO exchange' };
  }
}

/**
 * Main entry point: attempt Office SSO and exchange with backend.
 */
export async function attemptMicrosoftSSO(): Promise<SSOResult> {
  const officeResult = await getOfficeAccessToken();

  if (officeResult.needsFallback) {
    return {
      success: false,
      error: officeResult.error,
      needsConsent: officeResult.error?.includes('Admin consent'),
    };
  }

  if (!officeResult.token) {
    return { success: false, error: officeResult.error || 'Failed to obtain Office token' };
  }

  return exchangeTokenWithBackend(officeResult.token);
}

/**
 * Check whether the current Office host supports SSO at all.
 */
export function isOfficeSSOAvailable(): boolean {
  try {
    return !!(Office?.auth?.getAccessToken);
  } catch {
    return false;
  }
}
