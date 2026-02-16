import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contracts > Workflow | ConTigo',
  description: 'Contracts > Workflow — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
