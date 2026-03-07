import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Settings | ConTigo',
  description: 'Admin Settings — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
