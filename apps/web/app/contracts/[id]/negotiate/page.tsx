import NegotiationWorkflowClient from './NegotiationWorkflowClient';

export const metadata = {
  title: 'Negotiate Contract | ConTigo',
  description: 'Contract negotiation workflow with redline tracking',
};

export default async function NegotiatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NegotiationWorkflowClient contractId={id} />;
}
