import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Loss Prevention | ConTigo',
  description: 'Data Loss Prevention — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
