import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Evidence Vault | ConTigo',
  description: 'Evidence Vault — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
