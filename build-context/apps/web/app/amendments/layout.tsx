import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Amendments | ConTigo',
  description: 'Amendments — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
