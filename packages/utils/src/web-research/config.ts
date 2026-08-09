/**
 * Feature flag + config for optional Firecrawl public-web research.
 *
 * Disabled by default. Requires both ENABLE_FIRECRAWL_WEB_RESEARCH=true and
 * a non-empty FIRECRAWL_API_KEY. Never used on the contract OCR / upload path.
 */

export interface FirecrawlWebResearchConfig {
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string;
  /** Max characters of markdown returned per scrape (truncation). */
  maxMarkdownChars: number;
  /** Max search results to return. */
  maxSearchResults: number;
  /** Request timeout in ms. */
  timeoutMs: number;
}

const DEFAULT_BASE_URL = 'https://api.firecrawl.dev/v2';
const DEFAULT_MAX_MARKDOWN = 40_000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_TIMEOUT_MS = 30_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read Firecrawl web-research configuration from process.env.
 * Safe to call in any Node process; returns enabled:false when misconfigured.
 */
export function getFirecrawlWebResearchConfig(
  env: NodeJS.ProcessEnv = process.env
): FirecrawlWebResearchConfig {
  const flagOn = (env.ENABLE_FIRECRAWL_WEB_RESEARCH || '').toLowerCase() === 'true';
  const apiKey = (env.FIRECRAWL_API_KEY || '').trim();
  const hasKey =
    apiKey.length > 0 &&
    !apiKey.startsWith('fc-your') &&
    !/placeholder/i.test(apiKey);

  const baseUrl = (env.FIRECRAWL_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

  return {
    enabled: flagOn && hasKey,
    apiKey: hasKey ? apiKey : null,
    baseUrl,
    maxMarkdownChars: parsePositiveInt(env.FIRECRAWL_MAX_MARKDOWN_CHARS, DEFAULT_MAX_MARKDOWN),
    maxSearchResults: Math.min(
      10,
      parsePositiveInt(env.FIRECRAWL_MAX_SEARCH_RESULTS, DEFAULT_MAX_RESULTS)
    ),
    timeoutMs: parsePositiveInt(env.FIRECRAWL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

/** Convenience: is public-web research available right now? */
export function isFirecrawlWebResearchEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return getFirecrawlWebResearchConfig(env).enabled;
}
