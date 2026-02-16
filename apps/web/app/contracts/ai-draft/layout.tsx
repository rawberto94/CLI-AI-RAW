import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Contract Drafting | ConTigo',
  description: 'AI Contract Drafting — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
