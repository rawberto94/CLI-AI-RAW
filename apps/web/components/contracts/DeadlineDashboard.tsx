'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  Mail,
  CalendarDays,
  Target,
  FileText,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Deadline {
  id: string
  contractId: string
  contractName: string
  type: 'renewal' | 'expiration' | 'termination' | 'milestone' | 'sla' | 'payment' | 'deliverable'
  date: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'upcoming' | 'due-soon' | 'overdue' | 'completed'
  daysUntil: number
  clientName?: string
  supplierName?: string
  value?: number
  currency?: string
  notificationSent?: boolean
}

interface DeadlineDashboardProps {
  tenantId?: string
  clientFilter?: string
  typeFilter?: string
}

export function DeadlineDashboard({
  tenantId = 'demo',
  clientFilter,
  typeFilter,
}: DeadlineDashboardProps) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'timeline' | 'list' | 'calendar'>('timeline')
  const [filterType, setFilterType] = useState<string>(typeFilter || 'all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    loadDeadlines()
    
  }, [tenantId, clientFilter, filterType])

  const loadDeadlines = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (clientFilter) params.append('client', clientFilter)
      if (filterType !== 'all') params.append('type', filterType)
      
      const response = await fetch(`/api/deadlines?${params.toString()}`, {
        headers: { 'x-tenant-id': tenantId }
      })
      
      if (!response.ok) throw new Error('Failed to load deadlines')
      
      const data = await response.json()
      setDeadlines(data.deadlines || [])
    } catch {
      // Failed to load deadlines - silently handle
    } finally {
      setLoading(false)
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'overdue':
        return { 
          color: 'bg-red-100 text-red-700 border-red-300',
          icon: AlertCircle,
          label: 'Overdue'
        }
      case 'due-soon':
        return { 
          color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
          icon: AlertTriangle,
          label: 'Due Soon'
        }
      case 'upcoming':
        return { 
          color: 'bg-violet-100 text-violet-700 border-violet-300',
          icon: Clock,
          label: 'Upcoming'
        }
      case 'completed':
        return { 
          color: 'bg-green-100 text-green-700 border-green-300',
          icon: CheckCircle2,
          label: 'Completed'
        }
      default:
        return { 
          color: 'bg-gray-100 text-gray-700 border-gray-300',
          icon: Clock,
          label: 'Unknown'
        }
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'renewal': return Calendar
      case 'expiration': return Clock
      case 'termination': return AlertTriangle
      case 'milestone': return Target
      case 'sla': return TrendingUp
      case 'payment': return FileText
      case 'deliverable': return CheckCircle2
      default: return FileText
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const filteredDeadlines = deadlines.filter(d => {
    if (filterPriority !== 'all' && d.priority !== filterPriority) return false
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    return true
  })

  const stats = {
    total: filteredDeadlines.length,
    overdue: filteredDeadlines.filter(d => d.status === 'overdue').length,
    dueSoon: filteredDeadlines.filter(d => d.status === 'due-soon').length,
    upcoming: filteredDeadlines.filter(d => d.status === 'upcoming').length,
  }

  if (loading) {
    return (
      <Card className="shadow-2xl border-0">
        <CardContent className="p-12 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 mx-auto animate-spin text-violet-600 mb-4" />
            <p className="text-gray-600">Loading deadlines...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Deadline & Obligation Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Track contract deadlines, renewals, and key milestones</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadDeadlines} className="hover:bg-violet-50">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
            <Bell className="h-4 w-4 mr-2" />
            Configure Alerts
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
          <Card className="relative bg-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Overdue</p>
              <p className="text-4xl font-bold text-gray-900 mt-1">{stats.overdue}</p>
            </CardContent>
          </Card>
        </div>

        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
          <Card className="relative bg-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Due Soon</p>
              <p className="text-4xl font-bold text-gray-900 mt-1">{stats.dueSoon}</p>
            </CardContent>
          </Card>
        </div>

        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
          <Card className="relative bg-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Upcoming</p>
              <p className="text-4xl font-bold text-gray-900 mt-1">{stats.upcoming}</p>
            </CardContent>
          </Card>
        </div>

        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur"></div>
          <Card className="relative bg-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                  <CalendarDays className="h-6 w-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total</p>
              <p className="text-4xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters and View Options */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <span className="font-semibold text-gray-700">Filters:</span>
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="expiration">Expiration</SelectItem>
                  <SelectItem value="termination">Termination</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="sla">SLA</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="deliverable">Deliverable</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="low">Low Priority</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="due-soon">Due Soon</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className={cn(viewMode === 'timeline' && 'bg-gradient-to-r from-violet-600 to-purple-600')}
              >
                Timeline
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn(viewMode === 'list' && 'bg-gradient-to-r from-violet-600 to-purple-600')}
              >
                List
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={cn(viewMode === 'calendar' && 'bg-gradient-to-r from-violet-600 to-purple-600')}
              >
                Calendar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deadlines Display */}
      <Card className="shadow-2xl border-0">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            {viewMode === 'timeline' ? 'Timeline View' : viewMode === 'list' ? 'List View' : 'Calendar View'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {filteredDeadlines.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">No deadlines found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDeadlines.map((deadline) => {
                const statusConfig = getStatusConfig(deadline.status)
                const TypeIcon = getTypeIcon(deadline.type)
                const StatusIcon = statusConfig.icon
                
                return (
                  <div
                    key={deadline.id}
                    className={cn(
                      'p-6 rounded-xl border-2 transition-all hover:shadow-lg',
                      deadline.status === 'overdue' && 'border-red-200 bg-red-50',
                      deadline.status === 'due-soon' && 'border-yellow-200 bg-yellow-50',
                      deadline.status === 'upcoming' && 'border-violet-200 bg-violet-50',
                      deadline.status === 'completed' && 'border-green-200 bg-green-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={cn(
                          'p-3 rounded-xl shadow-lg',
                          deadline.status === 'overdue' && 'bg-gradient-to-br from-red-500 to-pink-600',
                          deadline.status === 'due-soon' && 'bg-gradient-to-br from-yellow-500 to-orange-600',
                          deadline.status === 'upcoming' && 'bg-gradient-to-br from-violet-500 to-purple-600',
                          deadline.status === 'completed' && 'bg-gradient-to-br from-violet-500 to-violet-600'
                        )}>
                          <TypeIcon className="h-6 w-6 text-white" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{deadline.contractName}</h3>
                            <Badge className={statusConfig.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {deadline.type.replace('-', ' ')}
                            </Badge>
                            <div className={cn('h-2 w-2 rounded-full', getPriorityColor(deadline.priority))}></div>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-3">{deadline.description}</p>
                          
                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span className="font-medium">{new Date(deadline.date).toLocaleDateString()}</span>
                              <span className={cn(
                                'font-bold',
                                deadline.daysUntil < 0 && 'text-red-600',
                                deadline.daysUntil >= 0 && deadline.daysUntil <= 30 && 'text-yellow-600',
                                deadline.daysUntil > 30 && 'text-violet-600'
                              )}>
                                ({deadline.daysUntil < 0 ? `${Math.abs(deadline.daysUntil)} days overdue` : 
                                   deadline.daysUntil === 0 ? 'Due today' :
                                   `${deadline.daysUntil} days left`})
                              </span>
                            </div>
                            
                            {deadline.clientName && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>{deadline.clientName}</span>
                              </div>
                            )}
                            
                            {deadline.value && (
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="font-semibold">{deadline.currency} {deadline.value.toLocaleString()}</span>
                              </div>
                            )}
                            
                            {deadline.notificationSent && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                <Mail className="h-3 w-3 mr-1" />
                                Notified
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm" className="hover:bg-violet-50">
                        View Contract
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Notification Setup */}
      <Card className="shadow-xl border-0 bg-gradient-to-br from-violet-50 to-purple-50">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-violet-100 rounded-lg">
              <Bell className="h-6 w-6 text-violet-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-violet-900 mb-2">Automatic Notifications</h3>
              <p className="text-sm text-violet-700 mb-4">
                Configure email alerts for upcoming deadlines. Get notified 30, 14, and 7 days before any deadline.
              </p>
              <div className="flex items-center gap-3">
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                  <Mail className="h-4 w-4 mr-2" />
                  Setup Email Alerts
                </Button>
                <Button variant="outline" className="hover:bg-white">
                  <Download className="h-4 w-4 mr-2" />
                  Export to Calendar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
