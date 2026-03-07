import { Metadata } from 'next';
import { MarketIntelligenceClientPage } from './client-page';

export const metadata: Metadata = {
  title: 'Market Intelligence | Procurement Intelligence',
  description: 'Market insights and rate trends',
};

export default function MarketIntelligencePage() {
  return <MarketIntelligenceClientPage />;
}
