import { ReportBuilder } from "@/components/reports/ReportBuilder";

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report Builder | ConTigo',
  description: 'Report Builder — Manage and monitor your contract intelligence platform',
};


export default function ReportBuilderPage() {
  return (
    <div className="container mx-auto py-6">
      <ReportBuilder />
    </div>
  );
}
