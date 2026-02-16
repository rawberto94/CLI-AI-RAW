import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Background Jobs | ConTigo',
  description: 'Background Jobs — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
