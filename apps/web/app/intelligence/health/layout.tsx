import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contract Health | ConTigo',
  description: 'Contract Health — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
