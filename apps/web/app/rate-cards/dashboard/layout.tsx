import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Card Dashboard | ConTigo',
  description: 'Rate Card Dashboard — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
