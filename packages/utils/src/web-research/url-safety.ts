/**
 * URL safety guards for public-web research only.
 *
 * Blocks private networks, loopback, link-local, and non-HTTP(S) schemes so
 * agent tools cannot be used for SSRF against internal services or to
 * "parse" tenant-local files.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // CGNAT 100.64/10
];

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isIpv6(host: string): boolean {
  return host.includes(':');
}

function isPrivateIpv4(host: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((re) => re.test(host));
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1' || h === '::') return true;
  // Unique local (fc00::/7), link-local (fe80::/10)
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true;
  }
  return false;
}

/**
 * Validate that a URL is safe for public-web scraping.
 * Returns the normalized href on success; throws UnsafeUrlError otherwise.
 */
export function assertPublicHttpUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new UnsafeUrlError('URL is required');
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    throw new UnsafeUrlError('URL is too long');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) {
    throw new UnsafeUrlError('URL hostname is required');
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeUrlError('Localhost and metadata hosts are not allowed');
  }

  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
    throw new UnsafeUrlError('Internal hostnames are not allowed');
  }

  if (isIpv4(hostname) && isPrivateIpv4(hostname)) {
    throw new UnsafeUrlError('Private IP addresses are not allowed');
  }

  if (isIpv6(hostname) && isPrivateIpv6(hostname)) {
    throw new UnsafeUrlError('Private IPv6 addresses are not allowed');
  }

  // Reject userinfo (credentials in URL) to avoid leaking secrets into logs
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed');
  }

  return parsed.href;
}

/**
 * True if the string looks like a public http(s) URL (does not throw).
 */
export function isPublicHttpUrl(rawUrl: string): boolean {
  try {
    assertPublicHttpUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
