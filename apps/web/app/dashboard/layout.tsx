import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | ConTigo',
  description: 'Overview of contract portfolio health, upcoming renewals, risk alerts, and AI-powered insights',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
