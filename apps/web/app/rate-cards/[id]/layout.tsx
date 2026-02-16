import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate cards | ConTigo',
  description: 'Rate cards — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
