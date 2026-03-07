import { redirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Cards | ConTigo',
  description: 'Rate Cards — Manage and monitor your contract intelligence platform',
};


// Redirect /rate-cards to /rate-cards/dashboard
export default function RateCardsPage() {
  redirect('/rate-cards/dashboard');
}
