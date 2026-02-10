import { Suspense } from 'react';
import ESignaturePageClient from './ESignaturePageClient';

export const metadata = {
  title: 'E-Signature | ConTigo',
  description: 'Collect digital signatures for contracts',
};

export default function ESignaturePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>}>
      <ESignaturePageClient contractId={params.id} />
    </Suspense>
  );
}
