import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notification Settings | ConTigo',
  description: 'Notification Settings — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
