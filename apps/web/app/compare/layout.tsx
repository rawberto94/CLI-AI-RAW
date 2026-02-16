import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contract Comparison | ConTigo',
  description: 'Contract Comparison — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
