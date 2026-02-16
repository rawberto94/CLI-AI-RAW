import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Management | ConTigo',
  description: 'User Management — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
