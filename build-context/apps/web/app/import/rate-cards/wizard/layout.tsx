import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Card Import Wizard | ConTigo',
  description: 'Rate Card Import Wizard — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
