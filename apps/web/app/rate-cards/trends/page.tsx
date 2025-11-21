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
    <div className="container mx-auto py-6">
      <Suspense fallback={<div>Loading emerging trends...</div>}>
        <EmergingTrendsPanel 
          tenantId={(session.user as any).tenantId || 'default'} 
          autoRefresh={true}
          refreshInterval={300000}
        />
      </Suspense>
    </div>
  );
}
