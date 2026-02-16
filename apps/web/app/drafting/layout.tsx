import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contract Drafting | ConTigo',
  description: 'Contract Drafting — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
