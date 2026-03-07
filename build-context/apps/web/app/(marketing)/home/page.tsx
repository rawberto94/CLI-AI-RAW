import { permanentRedirect } from 'next/navigation';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home | ConTigo',
  description: 'Home — Manage and monitor your contract intelligence platform',
};


export default function HomePage() {
  permanentRedirect('/');
}
