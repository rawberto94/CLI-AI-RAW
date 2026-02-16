/**
 * Team Page
 * Team collaboration and management
 */

import { Suspense } from 'react';
import { TeamCollaboration } from '@/components/team';
import { Breadcrumbs } from '@/components/breadcrumbs';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Management | ConTigo',
  description: 'Team Management — Manage and monitor your contract intelligence platform',
};


const breadcrumbItems = [
  { label: 'Team' },
];

export default function TeamPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumbs */}
      <div className="mb-6">
        <Breadcrumbs items={breadcrumbItems} showHomeIcon />
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      }>
        <TeamCollaboration />
      </Suspense>
    </div>
  );
}
