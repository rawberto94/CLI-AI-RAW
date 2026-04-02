/**
 * Rate Card Alerts Page
 * Manage alert rules for rate card monitoring
 */

import { Metadata } from 'next';
import { AlertManagementDashboard } from '@/components/rate-cards/AlertManagementDashboard';

export const metadata: Metadata = {
  title: 'Rate Card Alerts | Contigo Platform',
  description: 'Manage automated alerts for rate card monitoring',
};

export default function RateCardAlertsPage() {
  return (
    <div className="max-w-[1600px] mx-auto py-8">
      <AlertManagementDashboard />
    </div>
  );
}
