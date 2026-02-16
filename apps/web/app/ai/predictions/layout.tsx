import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Predictions | ConTigo',
  description: 'AI Predictions — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
