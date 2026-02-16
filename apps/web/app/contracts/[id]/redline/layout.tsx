import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contracts > Redline | ConTigo',
  description: 'Contracts > Redline — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
