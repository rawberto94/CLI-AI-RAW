import { Metadata } from 'next';
import { BaselinesPageContent } from './page-content';

export const metadata: Metadata = {
  title: 'Baseline Rates | Procurement Intelligence',
  description: 'Manage and track baseline target rates',
};

export default function BaselinesPage() {
  return <BaselinesPageContent />;
}
