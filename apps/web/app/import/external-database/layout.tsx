import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'External Database Import | ConTigo',
  description: 'External Database Import — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
