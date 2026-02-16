import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile Settings | ConTigo',
  description: 'Profile Settings — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
