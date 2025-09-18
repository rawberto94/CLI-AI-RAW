import { ContractPageClient } from './contract-page-client';

// Server component for Next.js 15 async params
export default async function ContractPage({ params }: { params: Promise<{ docId: string }> }) {
  const awaitedParams = await params;
  return <ContractPageClient params={awaitedParams} />;
}