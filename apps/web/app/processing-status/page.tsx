import { DashboardLayout } from '@/components/layout/AppLayout'
import ProcessingStatusDashboard from '@/components/processing/ProcessingStatusDashboard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Activity, RefreshCw, Settings } from 'lucide-react'

export default function ProcessingStatusPage() {
  return (
    <DashboardLayout
      title="Processing Status"
      description="Monitor contract processing jobs and worker status in real-time"
      actions={
        <div className="flex gap-2.5">
          <Button variant="outline" size="sm" className="h-8">
            <Settings className="h-3.5 w-3.5 mr-2" />
            Configure
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Refresh
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8">
            <Activity className="h-3.5 w-3.5 mr-2" />
            System Online
            <Badge variant="secondary" className="ml-2 px-2 py-0.5">Live</Badge>
          </Button>
        </div>
      }
    >
      <ProcessingStatusDashboard />
    </DashboardLayout>
  )
}

export const metadata = {
  title: 'Processing Status Dashboard',
  description: 'Monitor contract processing jobs and worker status in real-time'
}