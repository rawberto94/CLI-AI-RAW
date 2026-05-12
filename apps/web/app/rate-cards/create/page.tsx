import { redirect } from 'next/navigation';

export default function RateCardCreateRedirectPage() {
  redirect('/rate-cards/new');
}