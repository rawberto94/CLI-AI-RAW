import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Knowledge Graph | ConTigo',
  description: 'Knowledge Graph — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
