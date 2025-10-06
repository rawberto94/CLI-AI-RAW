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
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700">
            <Activity className="h-4 w-4 mr-2" />
            System Online
            <Badge variant="secondary" className="ml-2">Live</Badge>
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