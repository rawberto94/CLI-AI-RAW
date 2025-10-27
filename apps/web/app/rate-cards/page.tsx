import { redirect } from 'next/navigation';

// Redirect /rate-cards to /rate-cards/dashboard
export default function RateCardsPage() {
  redirect('/rate-cards/dashboard');
}
