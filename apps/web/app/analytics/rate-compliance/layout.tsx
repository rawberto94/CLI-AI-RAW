import type { Metadata } from 'next';
import { RateCardsDisabled } from '@/components/rate-cards/RateCardsDisabled';
import { isRateCardsEnabled } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Rate Compliance | ConTigo',
  description: 'Rate Compliance — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  if (!isRateCardsEnabled()) {
    return <RateCardsDisabled />;
  }
  return children;
}
