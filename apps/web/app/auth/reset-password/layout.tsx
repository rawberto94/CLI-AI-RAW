import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | ConTigo',
  description: 'Reset Password — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
