import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Drafting Copilot | ConTigo',
  description: 'Drafting Copilot — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
