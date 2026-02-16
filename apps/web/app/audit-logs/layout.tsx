import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit Logs | ConTigo',
  description: 'Audit Logs — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
