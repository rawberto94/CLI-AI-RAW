import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MFA Verification | ConTigo',
  description: 'MFA Verification — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
