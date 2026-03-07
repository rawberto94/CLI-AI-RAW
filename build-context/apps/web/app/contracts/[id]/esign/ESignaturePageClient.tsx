'use client';

import { DashboardLayout } from '@/components/layout/AppLayout';
import ESignatureWorkflow from '@/components/contracts/ESignatureWorkflow';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ESignaturePageClient({ contractId }: { contractId: string }) {
  return (
    <DashboardLayout
      title="E-Signature"
      description="Collect digital signatures for this contract"
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link href={`/contracts/${contractId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contract
          </Link>
        </Button>
      }
    >
      <div className="max-w-3xl mx-auto">
        <ESignatureWorkflow contractId={contractId} />
      </div>
    </DashboardLayout>
  );
}
