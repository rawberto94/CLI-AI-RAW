import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contract Comparison | ConTigo',
  description: 'Compare multiple contracts side-by-side with AI analysis of terms, risks, and financial differences',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
