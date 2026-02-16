import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Enhanced Contract View | ConTigo',
  description: 'Enhanced Contract View — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
