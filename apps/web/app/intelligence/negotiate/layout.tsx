import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Negotiation Intelligence | ConTigo',
  description: 'Negotiation Intelligence — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
