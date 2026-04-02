import { ScheduledReportsManager } from "@/components/reports/ScheduledReportsManager";

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scheduled Reports | ConTigo',
  description: 'Scheduled Reports — Manage and monitor your contract intelligence platform',
};


export default function ScheduledReportsPage() {
  return (
    <div className="max-w-[1600px] mx-auto py-6">
      <ScheduledReportsManager />
    </div>
  );
}
