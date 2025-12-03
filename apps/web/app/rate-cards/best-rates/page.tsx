/**
 * Best Rates Page
 * 
 * Displays the best (lowest) rates in the market for each role-geography combination
 */

import { Metadata } from 'next';
import { BestRatesPageContent } from './page-content';

export const metadata: Metadata = {
  title: 'Best Rates | Rate Card Benchmarking',
  description: 'View the best rates in the market for each role and geography',
};

export default function BestRatesPage() {
  return <BestRatesPageContent />;
}
