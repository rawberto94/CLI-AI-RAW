import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Activity Monitor | Contract Intelligence',
  description: 'Track AI agent activities, decisions, and recommendations in real-time for full transparency.',
  openGraph: {
    title: 'AI Activity Monitor',
    description: 'Real-time AI agent activity tracking',
  },
};

export default function AIActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
