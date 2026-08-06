'use client';

import { Suspense } from 'react';
import { NeedsYouInbox } from '@/components/inbox/NeedsYouInbox';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function InboxPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<PageSkeleton />}>
          <NeedsYouInbox />
        </Suspense>
      </div>
    </div>
  );
}
