import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vendor Risk | ConTigo',
  description: 'Vendor Risk — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
