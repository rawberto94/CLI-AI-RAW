import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Playbooks | ConTigo',
  description: 'Create and manage contract negotiation playbooks with policies, clauses, and red flags',
};

export default function PlaybooksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
