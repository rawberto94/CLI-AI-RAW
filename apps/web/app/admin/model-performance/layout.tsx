import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Model Performance | ConTigo',
  description: 'AI Model Performance — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
