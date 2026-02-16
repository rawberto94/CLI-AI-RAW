import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications | ConTigo',
  description: 'Notifications — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
