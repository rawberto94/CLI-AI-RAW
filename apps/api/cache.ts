type Entry<T> = { value: T; expiresAt: number };

export class TTLCache {
  private store = new Map<string, Entry<unknown>>();

  constructor(private defaultTtlMs = 15_000) {}

  get<T>(key: string): T | undefined {
    const e = this.store.get(key) as Entry<T> | undefined;
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set<T>(key: string, value: T, ttlMs?: number) {
    this.store.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  del(key: string) {
    this.store.delete(key);
  }
}

export const cache = new TTLCache();

// Lightweight daily cost/call guard for LLM usage
type Usage = { calls: number; tokens: number; resetAt: number };
const usageKey = (model: string) => `usage:${model}`;

export class LLMCostGuard {
  constructor(private dailyCalls = 500, private dailyTokens = 5_000_000) {}

  getUsage(model: string): Usage {
    const u = cache.get<Usage>(usageKey(model));
    const now = Date.now();
    if (!u || now > u.resetAt) {
      const next: Usage = { calls: 0, tokens: 0, resetAt: this.endOfDayTs() };
      cache.set(usageKey(model), next, next.resetAt - now);
      return next;
    }
    return u;
  }

  private endOfDayTs() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  canProceed(model: string, estTokens = 2000) {
    const u = this.getUsage(model);
    return u.calls + 1 <= this.dailyCalls && u.tokens + estTokens <= this.dailyTokens;
  }

  track(model: string, usedTokens = 2000) {
    const u = this.getUsage(model);
    u.calls += 1;
    u.tokens += usedTokens;
    const ttl = u.resetAt - Date.now();
    cache.set(usageKey(model), u, ttl > 0 ? ttl : undefined);
  }
}

export const llmCostGuard = new LLMCostGuard();
