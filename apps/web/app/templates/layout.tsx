import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Templates | ConTigo',
  description: 'Manage contract templates, clause libraries, and AI-powered document generation',
};

import { AutoBreadcrumbs } from '@/components/navigation/AutoBreadcrumbs';

export default function TemplatesLayout({
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
