'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { BaselineEntryForm } from '@/components/rate-cards/BaselineEntryForm';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { Button } from '@/components/ui/button';

export default function NewBaselinePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">
      <div className="max-w-[1200px] mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <Link href="/rate-cards/baselines">
              <Button variant="ghost" size="lg">
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
            </Link>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Add Baseline</h1>
              </div>
              <p className="text-slate-600">
                Create a baseline target rate to track procurement performance against your targets.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-white/60 shadow-xl p-6">
          <BaselineEntryForm
            onSuccess={() => {
              router.push('/rate-cards/baselines');
            }}
            onCancel={() => {
              router.push('/rate-cards/baselines');
            }}
          />
        </div>
      </div>
    </div>
  );
}