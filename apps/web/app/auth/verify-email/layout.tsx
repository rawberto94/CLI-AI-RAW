import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify Email | ConTigo',
  description: 'Verify Email — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
