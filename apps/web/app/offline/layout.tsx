import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline Mode | ConTigo',
  description: 'Offline Mode — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
