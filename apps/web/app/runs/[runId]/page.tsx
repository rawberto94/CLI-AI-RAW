import { RunDetailClient } from './run-detail-client';

// Server component for Next.js 15 async params
export default async function RunDetail(props: { params: Promise<{ runId: string }> }) {
  const params = await props.params;
  const awaitedParams = await params;
  return <RunDetailClient params={awaitedParams} />;
}
