/**
 * Team Page
 * Team collaboration and management
 */

import { Suspense } from 'react';
import { TeamCollaboration } from '@/components/team';

export default function TeamPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }>
        <TeamCollaboration />
      </Suspense>
    </div>
  );
}
