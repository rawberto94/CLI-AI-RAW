import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Requests | ConTigo',
  description: 'My Requests — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
