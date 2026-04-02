/**
 * Supplier Performance Dashboard Page
 */

import { SupplierPerformanceDashboard } from '@/components/suppliers/SupplierPerformanceDashboard';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Supplier Performance | ConTigo',
  description: 'Supplier Performance — Manage and monitor your contract intelligence platform',
};


export default function SupplierPerformancePage() {
  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4">
      <SupplierPerformanceDashboard />
    </div>
  );
}
