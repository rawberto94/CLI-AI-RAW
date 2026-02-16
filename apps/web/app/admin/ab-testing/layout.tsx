import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'A/B Testing | ConTigo',
  description: 'A/B Testing — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
