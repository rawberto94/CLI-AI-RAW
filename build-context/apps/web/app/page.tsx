import type { Metadata } from 'next';
import LandingPageClient from '@/components/marketing/LandingPageClient';

export const metadata: Metadata = {
  title: 'ConTigo — AI-Powered Contract Lifecycle Management',
  description:
    'Transform contract management with Swiss-engineered AI. Extract insights, track obligations, and manage your entire contract portfolio in one intelligent platform.',
  openGraph: {
    title: 'ConTigo — AI-Powered Contract Lifecycle Management',
    description:
      'Transform contract management with Swiss-engineered AI. Extract insights, track obligations, and manage your entire contract portfolio.',
    type: 'website',
  },
};

export default function LandingPage() {
  return <LandingPageClient />;
}
