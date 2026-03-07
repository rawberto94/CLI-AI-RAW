import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Self-Service Hub | ConTigo',
  description: 'Self-Service Hub — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
