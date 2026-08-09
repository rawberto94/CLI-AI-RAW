/**
 * Minimal Firecrawl client for *public* web research only.
 *
 * Supports search + scrape of public HTTP(S) URLs.
 * Intentionally does NOT support local file parse, document upload,
 * or any contract/OCR ingestion paths.
 */

import {
  getFirecrawlWebResearchConfig,
  type FirecrawlWebResearchConfig,
} from './config';
import { assertPublicHttpUrl, UnsafeUrlError } from './url-safety';

export { UnsafeUrlError };

export interface WebSearchResult {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  provider: 'firecrawl';
  disclaimer: string;
}

export interface WebScrapeResponse {
  url: string;
  title?: string;
  markdown: string;
  truncated: boolean;
  provider: 'firecrawl';
  disclaimer: string;
}

const DISCLAIMER =
  'Public web research only. Do not send tenant contracts or private documents. Sources may be incomplete or outdated.';

export class FirecrawlNotEnabledError extends Error {
  constructor() {
    super(
      'Firecrawl web research is disabled. Set ENABLE_FIRECRAWL_WEB_RESEARCH=true and FIRECRAWL_API_KEY.'
    );
    this.name = 'FirecrawlNotEnabledError';
  }
}

export class FirecrawlApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FirecrawlApiError';
    this.status = status;
  }
}

function truncateMarkdown(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (!text) return { text: '', truncated: false };
  if (text.length <= maxChars) return { text, truncated: false };
  return {
    text: `${text.slice(0, maxChars)}\n\n…[truncated for agent context]`,
    truncated: true,
  };
}

async function firecrawlFetch(
  path: string,
  body: Record<string, unknown>,
  config: FirecrawlWebResearchConfig
): Promise<unknown> {
  if (!config.enabled || !config.apiKey) {
    throw new FirecrawlNotEnabledError();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => null)) as
      | { success?: boolean; error?: string; data?: unknown; message?: string }
      | null;

    if (!res.ok) {
      const msg =
        payload?.error ||
        payload?.message ||
        `Firecrawl request failed with status ${res.status}`;
      throw new FirecrawlApiError(msg, res.status);
    }

    if (payload && payload.success === false) {
      throw new FirecrawlApiError(payload.error || payload.message || 'Firecrawl request failed');
    }

    return payload;
  } catch (err) {
    if (err instanceof FirecrawlApiError || err instanceof FirecrawlNotEnabledError) {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new FirecrawlApiError(`Firecrawl request timed out after ${config.timeoutMs}ms`);
    }
    throw new FirecrawlApiError(err instanceof Error ? err.message : 'Firecrawl request failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search the public web. Returns titles, URLs, and optional snippets.
 * Never accepts file bytes or private document content.
 */
export async function searchPublicWeb(
  query: string,
  options?: { limit?: number; scrapeResults?: boolean; env?: NodeJS.ProcessEnv }
): Promise<WebSearchResponse> {
  const config = getFirecrawlWebResearchConfig(options?.env);
  if (!config.enabled) {
    throw new FirecrawlNotEnabledError();
  }

  const q = (query || '').trim();
  if (q.length < 2) {
    throw new FirecrawlApiError('Search query must be at least 2 characters');
  }
  if (q.length > 500) {
    throw new FirecrawlApiError('Search query is too long');
  }

  const limit = Math.min(
    config.maxSearchResults,
    Math.max(1, options?.limit ?? config.maxSearchResults)
  );

  const body: Record<string, unknown> = {
    query: q,
    limit,
  };

  // Optional: attach light markdown for each hit (more credits)
  if (options?.scrapeResults) {
    body.scrapeOptions = {
      formats: ['markdown'],
      onlyMainContent: true,
    };
  }

  type SearchHit = {
    url?: string;
    title?: string;
    description?: string;
    markdown?: string;
  };

  const payload = (await firecrawlFetch('/search', body, config)) as {
    data?: {
      web?: SearchHit[];
    } | SearchHit[];
    web?: SearchHit[];
  };

  let rawHits: SearchHit[] = [];
  if (Array.isArray(payload?.data)) {
    rawHits = payload.data;
  } else if (payload?.data && Array.isArray(payload.data.web)) {
    rawHits = payload.data.web;
  } else if (Array.isArray(payload?.web)) {
    rawHits = payload.web;
  }

  const results: WebSearchResult[] = [];
  for (const hit of rawHits) {
    if (!hit?.url) continue;
    try {
      const safeUrl = assertPublicHttpUrl(hit.url);
      const md = hit.markdown
        ? truncateMarkdown(hit.markdown, Math.floor(config.maxMarkdownChars / limit)).text
        : undefined;
      results.push({
        url: safeUrl,
        title: (hit.title || safeUrl).slice(0, 300),
        description: hit.description?.slice(0, 500),
        markdown: md,
      });
    } catch {
      // Skip results that fail public-URL validation
    }
  }

  return {
    query: q,
    results,
    provider: 'firecrawl',
    disclaimer: DISCLAIMER,
  };
}

/**
 * Scrape a single public HTTP(S) URL to LLM-ready markdown.
 * Rejects private IPs, localhost, and non-http schemes.
 */
export async function scrapePublicUrl(
  url: string,
  options?: { env?: NodeJS.ProcessEnv }
): Promise<WebScrapeResponse> {
  const config = getFirecrawlWebResearchConfig(options?.env);
  if (!config.enabled) {
    throw new FirecrawlNotEnabledError();
  }

  const safeUrl = assertPublicHttpUrl(url);

  const payload = (await firecrawlFetch(
    '/scrape',
    {
      url: safeUrl,
      formats: ['markdown'],
      onlyMainContent: true,
    },
    config
  )) as {
    data?: {
      markdown?: string;
      metadata?: { title?: string; sourceURL?: string };
    };
    markdown?: string;
  };

  const markdownRaw =
    payload?.data?.markdown ||
    payload?.markdown ||
    '';
  const { text, truncated } = truncateMarkdown(String(markdownRaw), config.maxMarkdownChars);

  return {
    url: safeUrl,
    title: payload?.data?.metadata?.title,
    markdown: text,
    truncated,
    provider: 'firecrawl',
    disclaimer: DISCLAIMER,
  };
}
