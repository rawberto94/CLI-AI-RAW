import { RunDetailClient } from './run-detail-client';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Runs | ConTigo',
  description: 'Runs — Manage and monitor your contract intelligence platform',
};


// Server component for Next.js 15 async params
export default async function RunDetail(props: { params: Promise<{ runId: string }> }) {
  const params = await props.params;
  const awaitedParams = await params;
  return <RunDetailClient params={awaitedParams} />;
}
