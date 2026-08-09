import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  assertPublicHttpUrl,
  isPublicHttpUrl,
  UnsafeUrlError,
  getFirecrawlWebResearchConfig,
  isFirecrawlWebResearchEnabled,
  searchPublicWeb,
  scrapePublicUrl,
  FirecrawlNotEnabledError,
} from '../web-research';

describe('assertPublicHttpUrl', () => {
  it('accepts public https URLs', () => {
    expect(assertPublicHttpUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('rejects localhost and private IPs', () => {
    expect(() => assertPublicHttpUrl('http://localhost/admin')).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl('http://127.0.0.1/')).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl('http://192.168.1.1/')).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl('http://10.0.0.5/')).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl('http://172.16.0.1/')).toThrow(UnsafeUrlError);
  });

  it('rejects non-http schemes and credentials', () => {
    expect(() => assertPublicHttpUrl('file:///etc/passwd')).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl('ftp://example.com')).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl('https://user:pass@example.com')).toThrow(UnsafeUrlError);
  });

  it('isPublicHttpUrl mirrors assert without throwing', () => {
    expect(isPublicHttpUrl('https://docs.example.com')).toBe(true);
    expect(isPublicHttpUrl('http://169.254.169.254/latest')).toBe(false);
  });
});

describe('getFirecrawlWebResearchConfig', () => {
  it('is disabled by default', () => {
    const cfg = getFirecrawlWebResearchConfig({});
    expect(cfg.enabled).toBe(false);
    expect(isFirecrawlWebResearchEnabled({})).toBe(false);
  });

  it('requires both flag and api key', () => {
    expect(
      isFirecrawlWebResearchEnabled({
        ENABLE_FIRECRAWL_WEB_RESEARCH: 'true',
      })
    ).toBe(false);

    expect(
      isFirecrawlWebResearchEnabled({
        ENABLE_FIRECRAWL_WEB_RESEARCH: 'true',
        FIRECRAWL_API_KEY: 'fc-test-key-123',
      })
    ).toBe(true);

    expect(
      isFirecrawlWebResearchEnabled({
        ENABLE_FIRECRAWL_WEB_RESEARCH: 'false',
        FIRECRAWL_API_KEY: 'fc-test-key-123',
      })
    ).toBe(false);
  });

  it('rejects placeholder keys', () => {
    expect(
      isFirecrawlWebResearchEnabled({
        ENABLE_FIRECRAWL_WEB_RESEARCH: 'true',
        FIRECRAWL_API_KEY: 'fc-your-key-here',
      })
    ).toBe(false);
  });
});

describe('searchPublicWeb / scrapePublicUrl', () => {
  const env = {
    ENABLE_FIRECRAWL_WEB_RESEARCH: 'true',
    FIRECRAWL_API_KEY: 'fc-test-key-123',
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            web: [
              {
                url: 'https://example.com/pricing',
                title: 'Pricing',
                description: 'Plans',
              },
              {
                url: 'http://127.0.0.1/secret',
                title: 'Internal',
              },
            ],
            markdown: '# Hello world\n\nPublic content.',
            metadata: { title: 'Hello' },
          },
        }),
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when disabled', async () => {
    await expect(searchPublicWeb('test', { env: {} })).rejects.toBeInstanceOf(
      FirecrawlNotEnabledError
    );
  });

  it('filters private URLs from search results', async () => {
    const result = await searchPublicWeb('pricing', { env, limit: 5 });
    expect(result.provider).toBe('firecrawl');
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.url).toContain('example.com');
    expect(result.disclaimer).toMatch(/Public web research/i);
  });

  it('scrapes only public URLs', async () => {
    await expect(scrapePublicUrl('http://localhost/x', { env })).rejects.toBeInstanceOf(
      UnsafeUrlError
    );

    const page = await scrapePublicUrl('https://example.com/docs', { env });
    expect(page.markdown).toContain('Hello world');
    expect(page.url).toBe('https://example.com/docs');
  });
});
