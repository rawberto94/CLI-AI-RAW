import { RunDetailClient } from './run-detail-client';

// Server component for Next.js 15 async params
export default async function RunDetail({ params }: { params: Promise<{ runId: string }> }) {
  const awaitedParams = await params;
  return <RunDetailClient params={awaitedParams} />;
}
