import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SLA Compliance | Contract Intelligence',
  description: 'Monitor SLA compliance across workflows, track deadlines, and ensure timely approvals.',
  openGraph: {
    title: 'SLA Compliance Monitoring',
    description: 'Track SLA compliance and deadline adherence',
  },
};

export default function SLALayout({ children }: { children: React.ReactNode }) {
  return children;
}
