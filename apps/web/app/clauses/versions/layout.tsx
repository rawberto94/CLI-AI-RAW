import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clause Versions | ConTigo',
  description: 'Clause Versions — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
