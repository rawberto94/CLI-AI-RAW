import { redirect } from 'next/navigation';

export default function RateCardImportRedirectPage() {
  redirect('/rate-cards/upload');
}