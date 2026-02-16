/**
 * Rate Comparison Page
 */

import { RateComparisonTool } from '@/components/rate-cards/RateComparisonTool';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Comparison | ConTigo',
  description: 'Rate Comparison — Manage and monitor your contract intelligence platform',
};


export default function RateComparisonPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <RateComparisonTool />
    </div>
  );
}
