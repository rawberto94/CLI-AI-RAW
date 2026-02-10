import TerminationWizardClient from './TerminationWizardClient';

export const metadata = {
  title: 'Terminate Contract | ConTigo',
  description: 'Contract termination wizard',
};

export default async function TerminatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TerminationWizardClient contractId={id} />;
}
