import type { Metadata } from 'next';
import { RateCardsDisabled } from '@/components/rate-cards/RateCardsDisabled';
import { isRateCardsEnabled } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Rate Card Import | ConTigo',
  description: 'Rate Card Import — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!isRateCardsEnabled()) {
    return <RateCardsDisabled />;
  }
  return children;
}
