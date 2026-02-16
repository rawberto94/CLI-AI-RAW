import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Request | ConTigo',
  description: 'New Request — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
