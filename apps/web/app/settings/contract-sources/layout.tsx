import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contract Sources | ConTigo',
  description: 'Contract Sources — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
