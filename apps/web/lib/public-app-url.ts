const DEFAULT_APP_URL = 'http://localhost:3000';

function normalizeBaseUrl(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  if (!configuredUrl) {
    return DEFAULT_APP_URL;
  }

  return normalizeBaseUrl(configuredUrl);
}