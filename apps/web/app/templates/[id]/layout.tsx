import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Templates | ConTigo',
  description: 'Templates — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
