import { redirect } from 'next/navigation';

export default async function LegacyContractSourceDetailsPage({
  params,
}: {
  params: Promise<{ sourceId: string }>;
}) {
  const { sourceId } = await params;

  redirect(`/settings/contract-sources?sourceId=${encodeURIComponent(sourceId)}`);
}