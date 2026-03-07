import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys Management | ConTigo',
  description: 'API Keys Management — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
