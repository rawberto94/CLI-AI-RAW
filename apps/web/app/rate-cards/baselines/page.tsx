import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { BaselinesList } from '@/components/rate-cards/BaselinesList';
import { BaselineTrackingDashboard } from '@/components/rate-cards/BaselineTrackingDashboard';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { BaselinesPageContent } from './page-content';

export const metadata: Metadata = {
  title: 'Baseline Rates | Procurement Intelligence',
  description: 'Manage and track baseline target rates',
};

export default function BaselinesPage() {
  return <BaselinesPageContent />;
}
