import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication Error | ConTigo',
  description: 'Authentication Error — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
