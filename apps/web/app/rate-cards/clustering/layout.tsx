import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Clustering | ConTigo',
  description: 'Rate Clustering — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
