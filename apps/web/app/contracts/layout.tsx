import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contracts | ConTigo',
  description: 'Browse, search, and manage your contract library with AI-powered analysis and extraction',
};

import { AutoBreadcrumbs } from '@/components/navigation/AutoBreadcrumbs';

export default function ContractsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="px-6 pt-4">
        <AutoBreadcrumbs homeHref="/dashboard" homeLabel="Dashboard" />
      </div>
      {children}
    </div>
  );
}
