import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Contract | ConTigo',
  description: 'New Contract — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
