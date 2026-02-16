import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Job Monitor | ConTigo',
  description: 'Job Monitor — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
