import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Records Management | ConTigo',
  description: 'Records Management — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
