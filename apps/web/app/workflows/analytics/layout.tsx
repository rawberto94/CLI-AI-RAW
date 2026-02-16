import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workflow Analytics | Contract Intelligence',
  description: 'Monitor workflow performance, track bottlenecks, and optimize approval processes with comprehensive analytics.',
  openGraph: {
    title: 'Workflow Analytics',
    description: 'Monitor workflow performance and optimize approval processes',
  },
};

export default function WorkflowAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
