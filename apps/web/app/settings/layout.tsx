'use client';

import { AutoBreadcrumbs } from '@/components/navigation/AutoBreadcrumbs';

export default function SettingsLayout({
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
