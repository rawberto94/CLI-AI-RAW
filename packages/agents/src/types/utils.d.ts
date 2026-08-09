declare module 'utils' {
  export function convertCurrency(amount: number, from: string, to: string): number;
  export function normalizeToDaily(amount: number, uom: string): number;
  export type RoleMapping = { role: string; seniority: string; confidence: number };
  export function mapRoleDetail(raw: string): RoleMapping;

  // Public-web research (Firecrawl) — optional agent tooling only
  export function isFirecrawlWebResearchEnabled(env?: NodeJS.ProcessEnv): boolean;
  export function searchPublicWeb(
    query: string,
    options?: { limit?: number; scrapeResults?: boolean; env?: NodeJS.ProcessEnv }
  ): Promise<{
    query: string;
    results: Array<{ url: string; title: string; description?: string; markdown?: string }>;
    provider: 'firecrawl';
    disclaimer: string;
  }>;
  export function scrapePublicUrl(
    url: string,
    options?: { env?: NodeJS.ProcessEnv }
  ): Promise<{
    url: string;
    title?: string;
    markdown: string;
    truncated: boolean;
    provider: 'firecrawl';
    disclaimer: string;
  }>;
}
