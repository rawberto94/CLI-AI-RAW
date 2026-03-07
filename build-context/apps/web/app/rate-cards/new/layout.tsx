import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Rate Card | ConTigo',
  description: 'New Rate Card — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
