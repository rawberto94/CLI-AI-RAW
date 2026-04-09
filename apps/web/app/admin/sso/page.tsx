import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import SSOAdminPageClient from './SSOAdminPageClient';

export const metadata = {
  title: 'SSO Configuration | ConTigo Admin',
  description: 'Configure SAML 2.0 and OpenID Connect SSO providers',
};

export default function SSOAdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SSOAdminPageClient />
    </Suspense>
  );
}
