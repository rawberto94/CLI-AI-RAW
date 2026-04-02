import { BaselineCSVImport } from '@/components/rate-cards/BaselineCSVImport';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Import Baselines | ConTigo',
  description: 'Import Baselines — Manage and monitor your contract intelligence platform',
};


export default function BaselineImportPage() {
  return (
    <div className="max-w-[1600px] mx-auto py-8">
      <BaselineCSVImport />
    </div>
  );
}
