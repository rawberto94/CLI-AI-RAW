import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delegation of Authority | ConTigo',
  description: 'Delegation of Authority — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
