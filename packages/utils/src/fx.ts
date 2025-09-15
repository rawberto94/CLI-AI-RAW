// Simple FX conversion utility with static rates for demo purposes.
// In production, replace with a real FX service and time-aware rates.

const FX: Record<string, number> = {
    // Base: USD
    USD: 1,
    EUR: 1.1, // 1 EUR ≈ 1.10 USD
    GBP: 1.25, // 1 GBP ≈ 1.25 USD
    INR: 0.012, // 1 INR ≈ 0.012 USD
    CAD: 0.74,
    AUD: 0.66,
};

export function convertCurrency(amount: number, from: string, to: string): number {
    const f = (from || 'USD').toUpperCase();
    const t = (to || 'USD').toUpperCase();
    if (f === t) return amount;
    const toUsd = FX[t] || 1;
    // Convert via USD
    const inUsd = f === 'USD' ? amount : amount * (FX[f] ? FX[f] : 1);
    if (t === 'USD') return inUsd;
    // Convert USD -> target
    return inUsd / toUsd;
}

export function normalizeToDaily(amount: number, uom: string): number {
    const u = (uom || '').toLowerCase();
    if (u === 'day' || u === 'daily') return amount;
    if (u === 'hour' || u === 'hr' || u === 'h') return amount * 8; // 8h per day
    if (u === 'month' || u === 'mo') return amount / 22; // 22 working days per month
    if (u === 'year' || u === 'yr' || u === 'annum') return amount / (22 * 12);
    return amount; // default assume already daily
}
