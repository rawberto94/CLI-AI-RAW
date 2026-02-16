import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Intelligent Search | ConTigo',
  description: 'Intelligent Search — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
