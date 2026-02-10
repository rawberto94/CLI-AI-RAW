import { Suspense } from 'react';
import SSOAdminPageClient from './SSOAdminPageClient';

export const metadata = {
  title: 'SSO Configuration | ConTigo Admin',
  description: 'Configure SAML 2.0 and OpenID Connect SSO providers',
};

export default function SSOAdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>}>
      <SSOAdminPageClient />
    </Suspense>
  );
}
