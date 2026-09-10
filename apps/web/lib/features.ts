/** Rate Cards product surface. Off unless explicitly enabled. */
export function isRateCardsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RATE_CARDS_ENABLED === 'true'
}
