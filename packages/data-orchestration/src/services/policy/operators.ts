/**
 * Pure field assertion operators for policy FIELD rules.
 * No Prisma / I/O — unit-testable in isolation.
 */

export type OpResult =
  | { ok: true; pass: boolean; detail?: string }
  | { ok: false; missing: true; detail?: string }
  | { ok: false; error: string };

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,$%]/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }
  if (v instanceof Date) return v.getTime();
  return null;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na === nb;
  const da = toDate(a);
  const db = toDate(b);
  if (da && db) return da.getTime() === db.getTime();
  return asString(a).toLowerCase() === asString(b).toLowerCase();
}

function compareOrdered(a: unknown, b: unknown): number | null {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na < nb ? -1 : na > nb ? 1 : 0;
  const da = toDate(a);
  const db = toDate(b);
  if (da && db) {
    const ta = da.getTime();
    const tb = db.getTime();
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }
  const sa = asString(a).toLowerCase();
  const sb = asString(b).toLowerCase();
  if (!sa || !sb) return null;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Evaluate a binary/unary operator against resolved fact values.
 * `left` is assert.path; `right` is assert.value or assert.pathB value.
 */
export function evaluateOp(
  op: string,
  left: unknown,
  right: unknown,
  options?: { pathBValue?: unknown },
): OpResult {
  const pathB = options?.pathBValue;
  const rightVal = pathB !== undefined ? pathB : right;

  switch (op) {
    case 'exists': {
      const exists = left !== null && left !== undefined && left !== '';
      return { ok: true, pass: exists };
    }
    case 'absent': {
      const absent = left === null || left === undefined || left === '';
      return { ok: true, pass: absent };
    }
    case 'eq':
      if (left === null || left === undefined) return { ok: false, missing: true };
      return { ok: true, pass: valuesEqual(left, rightVal) };
    case 'ne':
      if (left === null || left === undefined) return { ok: false, missing: true };
      return { ok: true, pass: !valuesEqual(left, rightVal) };
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      if (left === null || left === undefined) return { ok: false, missing: true };
      if (rightVal === null || rightVal === undefined) return { ok: false, missing: true };
      const cmp = compareOrdered(left, rightVal);
      if (cmp === null) return { ok: false, error: 'incomparable values' };
      if (op === 'lt') return { ok: true, pass: cmp < 0 };
      if (op === 'lte') return { ok: true, pass: cmp <= 0 };
      if (op === 'gt') return { ok: true, pass: cmp > 0 };
      return { ok: true, pass: cmp >= 0 };
    }
    case 'in': {
      if (left === null || left === undefined) return { ok: false, missing: true };
      const list = Array.isArray(rightVal) ? rightVal : [rightVal];
      return { ok: true, pass: list.some((item) => valuesEqual(left, item)) };
    }
    case 'nin': {
      if (left === null || left === undefined) return { ok: false, missing: true };
      const list = Array.isArray(rightVal) ? rightVal : [rightVal];
      return { ok: true, pass: !list.some((item) => valuesEqual(left, item)) };
    }
    case 'contains': {
      if (left === null || left === undefined) return { ok: false, missing: true };
      if (Array.isArray(left)) {
        return { ok: true, pass: left.some((item) => valuesEqual(item, rightVal)) };
      }
      return {
        ok: true,
        pass: asString(left).toLowerCase().includes(asString(rightVal).toLowerCase()),
      };
    }
    case 'matches': {
      if (left === null || left === undefined) return { ok: false, missing: true };
      try {
        const re = new RegExp(asString(rightVal), 'i');
        return { ok: true, pass: re.test(asString(left)) };
      } catch {
        return { ok: false, error: 'invalid regex' };
      }
    }
    case 'between': {
      if (left === null || left === undefined) return { ok: false, missing: true };
      const bounds = Array.isArray(rightVal) ? rightVal : null;
      if (!bounds || bounds.length < 2) return { ok: false, error: 'between requires [min,max]' };
      const cMin = compareOrdered(left, bounds[0]);
      const cMax = compareOrdered(left, bounds[1]);
      if (cMin === null || cMax === null) return { ok: false, error: 'incomparable values' };
      return { ok: true, pass: cMin >= 0 && cMax <= 0 };
    }
    case 'older_than':
    case 'newer_than': {
      if (left === null || left === undefined) return { ok: false, missing: true };
      const d = toDate(left);
      if (!d) return { ok: false, error: 'not a date' };
      // right is days (number)
      const days = toNumber(rightVal);
      if (days === null) return { ok: false, error: 'days required' };
      const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
      if (op === 'older_than') return { ok: true, pass: d.getTime() < threshold };
      return { ok: true, pass: d.getTime() > threshold };
    }
    default:
      return { ok: false, error: `unknown op: ${op}` };
  }
}

/** Dot-path get with array index support: financial.lineItems.0.amount */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path || obj == null) return undefined;
  const parts = path.split('.');
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur) && /^\d+$/.test(part)) {
      cur = cur[Number(part)];
    } else if (typeof cur === 'object') {
      cur = cur[part];
    } else {
      return undefined;
    }
  }
  return cur;
}
