import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enhanced UI | ConTigo',
  description: 'Enhanced UI — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
