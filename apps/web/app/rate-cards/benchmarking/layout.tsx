import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rate Benchmarking | ConTigo',
  description: 'Rate Benchmarking — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
