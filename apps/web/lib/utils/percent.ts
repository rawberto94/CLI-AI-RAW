/**
 * Display percentages without 100000% explosions.
 *
 * - (0, 1] is treated as a 0–1 fraction → ×100
 * - (1, 100] is already a percent
 * - 0 is 0%
 * - anything else is invalid (null)
 */

export function normalizePercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  if (value === 0) return 0;
  if (value <= 1) return Math.round(value * 1000) / 10; // 0.856 → 85.6
  if (value <= 100) return Math.round(value * 10) / 10;
  if (value <= 1000 && value % 1 !== 0) {
    // e.g. 850.5 stored as basis points-ish — still not a display percent
    return null;
  }
  return null;
}

export function formatPercent(value: unknown, decimals = 0): string {
  const percent = normalizePercent(value);
  if (percent == null) return '—';
  return `${percent.toFixed(decimals)}%`;
}

export function clampTrendPercent(change: number, previousCount: number, minPrevious = 5): number {
  if (!Number.isFinite(change)) return 0;
  if (previousCount < minPrevious) return Math.max(-100, Math.min(100, change));
  return Math.max(-999, Math.min(999, Math.round(change)));
}
