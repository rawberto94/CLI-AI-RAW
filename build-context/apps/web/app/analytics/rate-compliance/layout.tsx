import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Compliance | ConTigo',
  description: 'Rate Compliance — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
