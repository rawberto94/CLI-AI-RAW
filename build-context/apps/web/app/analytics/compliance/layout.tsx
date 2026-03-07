import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compliance Analytics | ConTigo',
  description: 'Compliance Analytics — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
