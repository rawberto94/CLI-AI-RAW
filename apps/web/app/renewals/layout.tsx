import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Renewals | ConTigo',
  description: 'Renewals — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
