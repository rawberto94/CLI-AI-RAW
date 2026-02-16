import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Signature Policies | ConTigo',
  description: 'Signature Policies — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
