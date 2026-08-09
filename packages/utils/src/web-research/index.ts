/**
 * Public-web research helpers (Firecrawl-backed, feature-flagged).
 *
 * Scope: agent/chat research on public internet sources only.
 * Out of scope: contract upload OCR, local file parse, tenant document bytes.
 */

export {
  getFirecrawlWebResearchConfig,
  isFirecrawlWebResearchEnabled,
  type FirecrawlWebResearchConfig,
} from './config';

export {
  assertPublicHttpUrl,
  isPublicHttpUrl,
  UnsafeUrlError,
} from './url-safety';

export {
  searchPublicWeb,
  scrapePublicUrl,
  FirecrawlNotEnabledError,
  FirecrawlApiError,
  type WebSearchResult,
  type WebSearchResponse,
  type WebScrapeResponse,
} from './firecrawl-client';
