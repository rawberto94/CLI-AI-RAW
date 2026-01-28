import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { EmergingTrendsPanel } from '@/components/rate-cards/EmergingTrendsPanel';

export const metadata = {
  title: 'Emerging Trends | Rate Cards',
  description: 'Monitor emerging market trends and significant rate changes',
};

export default async function EmergingTrendsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-violet-50/20">
      <div className="container mx-auto py-6">
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 animate-pulse shadow-lg" />
              <p className="text-slate-600">Loading emerging trends...</p>
            </div>
          </div>
        }>
          <EmergingTrendsPanel 
            tenantId={(session.user as any).tenantId || 'default'} 
            autoRefresh={true}
            refreshInterval={300000}
          />
        </Suspense>
      </div>
    </div>
  );
}
