/**
 * Approval Queue Page
 * 
 * Human-in-the-loop approval dashboard for contracts, AI outputs, and amendments.
 */

import { Metadata } from 'next';
import ApprovalQueueDashboard from '@/components/approvals/ApprovalQueueDashboard';

export const metadata: Metadata = {
  title: 'Approval Queue | ConTigo CLM',
  description: 'Manage pending approvals for contracts, AI outputs, and amendments',
};

export default function ApprovalQueuePage() {
  return (
    <div className="container mx-auto py-6">
      <ApprovalQueueDashboard />
    </div>
  );
}
