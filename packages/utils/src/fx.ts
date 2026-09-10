// Indicative static FX for display conversion only. Never persist converted
// amounts as the source contract value. Missing/unknown currency must stay XXX.

const FX: Record<string, number> = {
    // Base: USD (units of USD per 1 unit of currency)
    USD: 1,
    EUR: 1.08,
    GBP: 1.27,
    CHF: 1.12,
    JPY: 0.0067,
    INR: 0.012,
    CAD: 0.74,
    AUD: 0.66,
};

export function convertCurrency(amount: number, from: string, to: string): number {
    const f = (from || '').toUpperCase();
    const t = (to || '').toUpperCase();
    if (!f || !t) {
        throw new Error('Currency required');
    }
    if (f === t) return amount;
    const fromRate = FX[f];
    const toRate = FX[t];
    if (fromRate == null || toRate == null) {
        throw new Error(`No FX rate for ${fromRate == null ? f : t}`);
    }
    const inUsd = f === 'USD' ? amount : amount * fromRate;
    if (t === 'USD') return inUsd;
    return inUsd / toRate;
}

export function tryConvertCurrency(amount: number, from: string, to: string): number | null {
    try {
        return convertCurrency(amount, from, to);
    } catch {
        return null;
    }
}

/** ISO 4217 code for “no currency involved”. */
export const UNKNOWN_CURRENCY = 'XXX';

/** Format an amount for user-visible text. Never invents USD or CHF. */
export function formatMoneyText(amount: number, currency?: string | null): string {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const formatted = n.toLocaleString('de-CH', { maximumFractionDigits: 0 });
    const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    if (/^[A-Z]{3}$/.test(code) && code !== UNKNOWN_CURRENCY) return `${code} ${formatted}`;
    return formatted;
}

/** Persist a real ISO code, or XXX — never invent USD. */
export function resolvePersistCurrency(
    ...candidates: Array<string | null | undefined>
): string {
    for (const candidate of candidates) {
        const code = typeof candidate === 'string' ? candidate.trim().toUpperCase() : '';
        if (/^[A-Z]{3}$/.test(code) && code !== UNKNOWN_CURRENCY) return code;
    }
    return UNKNOWN_CURRENCY;
}

/** Infer a currency code from surrounding text. Returns null when none is stated. */
export function detectCurrencyFromText(text: string | null | undefined): string | null {
    const value = text || '';
    if (/\bCHF\b|\bSFr\.?\b|(?:^|[^\w])Fr\./i.test(value)) return 'CHF';
    if (/€|\bEUR\b/i.test(value)) return 'EUR';
    if (/£|\bGBP\b/i.test(value)) return 'GBP';
    if (/\bCAD\b|C\$/i.test(value)) return 'CAD';
    if (/\bAUD\b|A\$/i.test(value)) return 'AUD';
    if (/\bJPY\b/i.test(value)) return 'JPY';
    if (/\bUSD\b|US\$/i.test(value)) return 'USD';
    if (/\$/.test(value)) return 'USD';
    if (/¥/.test(value)) return 'JPY';
    return null;
}

export function normalizeToDaily(amount: number, uom: string): number {
    const u = (uom || '').toLowerCase();
    if (u === 'day' || u === 'daily') return amount;
    if (u === 'hour' || u === 'hr' || u === 'h') return amount * 8; // 8h per day
    if (u === 'month' || u === 'mo') return amount / 22; // 22 working days per month
    if (u === 'year' || u === 'yr' || u === 'annum') return amount / (22 * 12);
    return amount; // default assume already daily
}
