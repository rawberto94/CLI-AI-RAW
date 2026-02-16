import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Routing Rules | ConTigo',
  description: 'Routing Rules — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
