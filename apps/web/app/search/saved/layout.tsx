import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved Searches | ConTigo',
  description: 'Saved Searches — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
