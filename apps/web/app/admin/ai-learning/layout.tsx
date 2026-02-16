import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Learning Center | ConTigo',
  description: 'AI Learning Center — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
