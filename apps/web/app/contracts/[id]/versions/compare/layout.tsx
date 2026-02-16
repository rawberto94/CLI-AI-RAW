import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contracts > Versions > Compare | ConTigo',
  description: 'Contracts > Versions > Compare — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
