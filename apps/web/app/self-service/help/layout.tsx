import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center | ConTigo',
  description: 'Help Center — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
