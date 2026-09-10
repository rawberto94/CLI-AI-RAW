import { DashboardLayout } from '@/components/layout/AppLayout'
import ProcessingStatusDashboard from '@/components/processing/ProcessingStatusDashboard'

export default function ProcessingStatusPage() {
  return (
    <DashboardLayout
      title="Processing Status"
      description="Monitor contract processing jobs and worker status in real-time"
    >
      <ProcessingStatusDashboard />
    </DashboardLayout>
  )
}

export const metadata = {
  title: 'Processing Status Dashboard',
  description: 'Monitor contract processing jobs and worker status in real-time'
}