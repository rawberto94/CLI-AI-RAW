import type { Metadata } from 'next';
import { UploadErrorBoundary } from './components/UploadErrorBoundary';

export const metadata: Metadata = {
  title: 'Upload Contract | ConTigo',
  description: 'Upload Contract — Manage and monitor your contract intelligence platform',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UploadErrorBoundary>{children}</UploadErrorBoundary>;
}
