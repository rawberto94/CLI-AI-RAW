import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workflow Designer | ConTigo',
  description: 'Workflow Designer — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
