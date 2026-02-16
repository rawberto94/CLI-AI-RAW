import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pre-Approval Gates | ConTigo',
  description: 'Pre-Approval Gates — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
