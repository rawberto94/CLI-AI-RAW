import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'System Administration - Contract Intelligence',
  description: 'Monitor system health, performance, and configuration settings',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Settings,
  Activity,
  Database,
  Cpu,
  Network,
  Shield,
  FileText,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Server,
  HardDrive,
  Wifi,
  Lock,
  Eye,
  Download,
  RefreshCw,
  Bell,
  Gauge,
  BarChart3,
  Globe,
  Zap
} from 'lucide-react'
import Link from 'next/link'

// Mock system data
const systemData = {
  overview: {
    systemHealth: 98.7,
    uptime: 99.97,
    activeUsers: 234,
    processingJobs: 12,
    totalStorage: 2.4, // TB
    usedStorage: 1.8, // TB
    apiCalls: 45678,
    errorRate: 0.03
  },
  services: [
    {
      name: 'Contract Processing Engine',
      status: 'healthy',
      uptime: 99.98,
      responseTime: 245,
      throughput: 1247,
      lastRestart: '2024-01-15 03:00:00',
      version: 'v2.4.1'
    },
    {
      name: 'AI Analysis Service',
      status: 'healthy',
      uptime: 99.95,
      responseTime: 1850,
      throughput: 892,
      lastRestart: '2024-01-14 02:30:00',
      version: 'v1.8.3'
    },
    {
      name: 'Document Storage',
      status: 'healthy',
      uptime: 99.99,
      responseTime: 89,
      throughput: 3456,
      lastRestart: '2024-01-10 01:00:00',
      version: 'v3.1.2'
    },
    {
      name: 'Search Index',
      status: 'warning',
      uptime: 99.87,
      responseTime: 567,
      throughput: 2134,
      lastRestart: '2024-01-16 14:30:00',
      version: 'v2.2.1'
    },
    {
      name: 'Notification Service',
      status: 'healthy',
      uptime: 99.92,
      responseTime: 123,
      throughput: 5678,
      lastRestart: '2024-01-12 05:15:00',
      version: 'v1.5.4'
    }
  ],
  infrastructure: {
    servers: [
      { name: 'Web Server 1', cpu: 45, memory: 67, disk: 34, status: 'healthy' },
      { name: 'Web Server 2', cpu: 52, memory: 71, disk: 28, status: 'healthy' },
      { name: 'API Server 1', cpu: 78, memory: 84, disk: 45, status: 'warning' },
      { name: 'API Server 2', cpu: 34, memory: 56, disk: 23, status: 'healthy' },
      { name: 'Database Primary', cpu: 67, memory: 89, disk: 78, status: 'healthy' },
      { name: 'Database Replica', cpu: 23, memory: 45, disk: 67, status: 'healthy' }
    ],
    network: {
      bandwidth: 85.6,
      latency: 12.3,
      packetLoss: 0.01,
      connections: 1247
    }
  },
  security: {
    threatLevel: 'Low',
    blockedAttacks: 23,
    securityScore: 94.8,
    lastScan: '2024-01-20 06:00:00',
    vulnerabilities: {
      critical: 0,
      high: 1,
      medium: 3,
      low: 8
    }
  },
  recentEvents: [
    {
      timestamp: '2024-01-20 14:30:00',
      type: 'info',
      service: 'Search Index',
      message: 'Index rebuild completed successfully',
      details: 'Full text search index rebuilt with 1,247 contracts'
    },
    {
      timestamp: '2024-01-20 12:15:00',
      type: 'warning',
      service: 'API Server 1',
      message: 'High CPU usage detected',
      details: 'CPU usage exceeded 80% threshold for 15 minutes'
    },
    {
      timestamp: '2024-01-20 09:45:00',
      type: 'success',
      service: 'AI Analysis',
      message: 'Batch processing completed',
      details: '89 contracts processed successfully'
    },
    {
      timestamp: '2024-01-20 08:30:00',
      type: 'info',
      service: 'Database',
      message: 'Automated backup completed',
      details: 'Daily backup completed in 23 minutes'
    }
  ]
}

export default function SystemPage() {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'text-green-600 bg-green-50'
      case 'warning': return 'text-yellow-600 bg-yellow-50'
      case 'critical': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />
      case 'warning': return <AlertTriangle className="w-4 h-4" />
      case 'critical': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />
      default: return <Activity className="w-4 h-4 text-blue-600" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            System Administration
          </h1>
          <p className="text-gray-600 mt-1">Monitor system health, performance, and configuration</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
          <Button variant="outline" size="sm">
            <Bell className="w-4 h-4 mr-2" />
            Alerts
          </Button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Health</p>
                <p className="text-3xl font-bold text-gray-900">{systemData.overview.systemHealth}%</p>
                <div className="flex items-center mt-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">Excellent</span>
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <Gauge className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-3xl font-bold text-gray-900">{systemData.overview.uptime}%</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-gray-600">This quarter</span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-3xl font-bold text-gray-900">{systemData.overview.activeUsers}</p>
                <div className="flex items-center mt-2">
                  <Users className="w-4 h-4 text-purple-600 mr-1" />
                  <span className="text-sm text-gray-600">Currently online</span>
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processing Jobs</p>
                <p className="text-3xl font-bold text-gray-900">{systemData.overview.processingJobs}</p>
                <div className="flex items-center mt-2">
                  <Zap className="w-4 h-4 text-orange-600 mr-1" />
                  <span className="text-sm text-gray-600">In queue</span>
                </div>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <Cpu className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/processing-status">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-blue-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Activity className="w-8 h-8 text-blue-600" />
                </div>
                <Badge className="bg-green-100 text-green-800">Live</Badge>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing Status</h3>
              <p className="text-gray-600 mb-4">Monitor real-time processing jobs and system health</p>
              <div className="flex items-center text-sm text-blue-600 font-medium">
                View Status <Eye className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/api-docs">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-green-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-xl">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <Badge variant="outline">v2.4</Badge>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">API Documentation</h3>
              <p className="text-gray-600 mb-4">Complete API reference and integration guides</p>
              <div className="flex items-center text-sm text-green-600 font-medium">
                View Docs <FileText className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-purple-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-xl">
                  <Settings className="w-8 h-8 text-purple-600" />
                </div>
                <Badge variant="outline">Admin</Badge>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">System Settings</h3>
              <p className="text-gray-600 mb-4">Configure system parameters and preferences</p>
              <div className="flex items-center text-sm text-purple-600 font-medium">
                Configure <Settings className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-6 h-6 text-blue-600" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemData.services.map((service, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getStatusColor(service.status)}`}>
                      {getStatusIcon(service.status)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{service.name}</h4>
                      <p className="text-sm text-gray-600">Version {service.version}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(service.status)}>
                    {service.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-lg font-bold text-green-600">{service.uptime}%</div>
                    <div className="text-gray-600">Uptime</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-lg font-bold text-blue-600">{service.responseTime}ms</div>
                    <div className="text-gray-600">Response Time</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-lg font-bold text-purple-600">{service.throughput}</div>
                    <div className="text-gray-600">Throughput/hr</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <div className="text-sm text-gray-600">Last Restart</div>
                    <div className="text-sm font-medium text-gray-900">{service.lastRestart}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Infrastructure & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6 text-green-600" />
              Infrastructure Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {systemData.infrastructure.network.bandwidth}%
                  </div>
                  <div className="text-sm text-gray-600">Bandwidth Usage</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {systemData.infrastructure.network.latency}ms
                  </div>
                  <div className="text-sm text-gray-600">Network Latency</div>
                </div>
              </div>
              
              <div className="space-y-3">
                {systemData.infrastructure.servers.map((server, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">{server.name}</h5>
                      <Badge className={getStatusColor(server.status)}>
                        {server.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>CPU</span>
                          <span>{server.cpu}%</span>
                        </div>
                        <Progress value={server.cpu} className="h-1" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Memory</span>
                          <span>{server.memory}%</span>
                        </div>
                        <Progress value={server.memory} className="h-1" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span>Disk</span>
                          <span>{server.disk}%</span>
                        </div>
                        <Progress value={server.disk} className="h-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-600" />
              Security Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {systemData.security.securityScore}%
                </div>
                <div className="text-sm text-gray-600">Security Score</div>
                <Badge className="mt-2 bg-green-100 text-green-800">
                  {systemData.security.threatLevel} Threat Level
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {systemData.security.blockedAttacks}
                  </div>
                  <div className="text-sm text-gray-600">Blocked Attacks</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">Last Scan</div>
                  <div className="text-sm font-medium text-gray-900">
                    {systemData.security.lastScan}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium text-gray-700">Vulnerabilities</h5>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center p-2 bg-red-50 rounded">
                    <div className="font-bold text-red-600">{systemData.security.vulnerabilities.critical}</div>
                    <div className="text-gray-600">Critical</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <div className="font-bold text-orange-600">{systemData.security.vulnerabilities.high}</div>
                    <div className="text-gray-600">High</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded">
                    <div className="font-bold text-yellow-600">{systemData.security.vulnerabilities.medium}</div>
                    <div className="text-gray-600">Medium</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-bold text-green-600">{systemData.security.vulnerabilities.low}</div>
                    <div className="text-gray-600">Low</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Recent System Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {systemData.recentEvents.map((event, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-medium text-gray-900">{event.message}</h5>
                    <span className="text-sm text-gray-500">{event.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{event.details}</p>
                  <Badge variant="outline" className="text-xs">
                    {event.service}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}