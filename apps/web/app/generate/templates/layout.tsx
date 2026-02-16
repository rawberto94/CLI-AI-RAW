import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Generation Templates | ConTigo',
  description: 'Generation Templates — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
