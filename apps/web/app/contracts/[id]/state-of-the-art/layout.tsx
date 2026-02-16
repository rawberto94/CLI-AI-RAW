import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contracts > State of the art | ConTigo',
  description: 'Contracts > State of the art — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
