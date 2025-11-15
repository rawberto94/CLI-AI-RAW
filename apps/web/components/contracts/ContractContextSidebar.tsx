/**
 * Smart Context Sidebar
 * Persistent sidebar showing key contract information, dates, parties, and quick actions
 * Always visible to reduce cognitive load and eliminate scrolling
 */

'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  DollarSign,
  Shield,
  Calendar,
  Clock,
  Building,
  Users,
  Mail,
  Download,
  Share2,
  Bell,
  Copy,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContractContextSidebarProps {
  contractId: string
  contractName: string
  status: string
  value?: number
  currency?: string
  riskScore?: number
  riskLevel?: string
  effectiveDate?: string
  expirationDate?: string
  startDate?: string
  endDate?: string
  client?: {
    name: string
    contact?: string
  }
  supplier?: {
    name: string
    contact?: string
  }
  onExport?: () => void
  onShare?: () => void
  onReminder?: () => void
  onDuplicate?: () => void
}

export function ContractContextSidebar({
  contractId,
  contractName,
  status,
  value,
  currency = 'USD',
  riskScore,
  riskLevel,
  effectiveDate,
  expirationDate,
  startDate,
  endDate,
  client,
  supplier,
  onExport,
  onShare,
  onReminder,
  onDuplicate,
}: ContractContextSidebarProps) {
  
  // Calculate days until expiration
  const daysUntilExpiration = expirationDate 
    ? Math.ceil((new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration < 90
  const isExpired = daysUntilExpiration !== null && daysUntilExpiration < 0

  // Status configuration
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'completed':
        return { color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 }
      case 'pending':
      case 'processing':
        return { color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Clock }
      case 'expired':
      case 'failed':
        return { color: 'bg-red-100 text-red-700 border-red-300', icon: AlertTriangle }
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-300', icon: FileText }
    }
  }

  const statusConfig = getStatusConfig(status)
  const StatusIcon = statusConfig.icon

  // Risk color
  const getRiskColor = (score?: number) => {
    if (!score) return 'text-gray-500'
    if (score < 30) return 'text-green-600'
    if (score < 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="w-80 space-y-4 sticky top-6">
      {/* Contract Identity */}
      <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
              {contractName}
            </h3>
            <div className="flex items-center gap-2">
              <Badge className={cn('px-3 py-1.5 border', statusConfig.color)}>
                <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                {status}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 font-mono mt-2">
              ID: {contractId}
            </p>
          </div>

          <Separator />

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Contract Value */}
            {value !== undefined && (
              <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-green-100 rounded">
                    <DollarSign className="h-3.5 w-3.5 text-green-700" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">Value</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {currency} {value.toLocaleString()}
                </p>
              </div>
            )}

            {/* Risk Score */}
            {riskScore !== undefined && (
              <div className={cn(
                'p-3 rounded-lg border',
                riskScore < 30 
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
                  : riskScore < 70
                  ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-100'
                  : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-100'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    'p-1.5 rounded',
                    riskScore < 30 ? 'bg-green-100' : riskScore < 70 ? 'bg-yellow-100' : 'bg-red-100'
                  )}>
                    <Shield className={cn(
                      'h-3.5 w-3.5',
                      riskScore < 30 ? 'text-green-700' : riskScore < 70 ? 'text-yellow-700' : 'text-red-700'
                    )} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">Risk</span>
                </div>
                <p className={cn('text-lg font-bold', getRiskColor(riskScore))}>
                  {riskScore}/100
                </p>
              </div>
            )}

            {/* Days Until Expiration */}
            {daysUntilExpiration !== null && (
              <div className={cn(
                'col-span-2 p-3 rounded-lg border',
                isExpired
                  ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
                  : isExpiringSoon
                  ? 'bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200'
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    'p-1.5 rounded',
                    isExpired ? 'bg-red-100' : isExpiringSoon ? 'bg-orange-100' : 'bg-blue-100'
                  )}>
                    <Calendar className={cn(
                      'h-3.5 w-3.5',
                      isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-blue-700'
                    )} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    {isExpired ? 'Expired' : 'Expires In'}
                  </span>
                </div>
                <p className={cn(
                  'text-lg font-bold',
                  isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-blue-700'
                )}>
                  {isExpired 
                    ? `${Math.abs(daysUntilExpiration)} days ago`
                    : `${daysUntilExpiration} days`
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Dates Timeline */}
      {(effectiveDate || startDate || expirationDate || endDate) && (
        <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
          <CardContent className="p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              Key Dates
            </h4>
            <div className="space-y-3">
              {(effectiveDate || startDate) && (
                <DatePoint
                  label="Start Date"
                  date={effectiveDate || startDate || ''}
                  status="passed"
                />
              )}
              {(expirationDate || endDate) && (
                <DatePoint
                  label="Expiration"
                  date={expirationDate || endDate || ''}
                  status={isExpired ? 'overdue' : isExpiringSoon ? 'upcoming' : 'future'}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parties */}
      {(client || supplier) && (
        <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
          <CardContent className="p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-600" />
              Parties
            </h4>
            <div className="space-y-3">
              {client && (
                <PartyCard
                  type="Client"
                  name={client.name}
                  contact={client.contact}
                  icon={Building}
                  color="blue"
                />
              )}
              {supplier && (
                <PartyCard
                  type="Supplier"
                  name={supplier.name}
                  contact={supplier.contact}
                  icon={Users}
                  color="purple"
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="shadow-lg border-0 bg-white/95 backdrop-blur">
        <CardContent className="p-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Quick Actions
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="justify-start hover:bg-blue-50 hover:border-blue-300"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="justify-start hover:bg-purple-50 hover:border-purple-300"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReminder}
              className="justify-start hover:bg-orange-50 hover:border-orange-300"
            >
              <Bell className="h-4 w-4 mr-2" />
              Remind
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDuplicate}
              className="justify-start hover:bg-green-50 hover:border-green-300"
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper Components

function DatePoint({ 
  label, 
  date, 
  status 
}: { 
  label: string
  date: string
  status: 'passed' | 'current' | 'upcoming' | 'future' | 'overdue'
}) {
  const statusConfig = {
    passed: { color: 'bg-gray-100 text-gray-600', icon: CheckCircle2 },
    current: { color: 'bg-blue-100 text-blue-700', icon: Clock },
    upcoming: { color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
    future: { color: 'bg-green-100 text-green-700', icon: Calendar },
    overdue: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', config.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{date}</p>
      </div>
    </div>
  )
}

function PartyCard({
  type,
  name,
  contact,
  icon: Icon,
  color,
}: {
  type: string
  name: string
  contact?: string
  icon: any
  color: 'blue' | 'purple'
}) {
  const colorConfig = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  }

  return (
    <div className={cn('p-3 rounded-lg border', colorConfig[color])}>
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-white rounded">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium opacity-75 mb-0.5">{type}</p>
          <p className="text-sm font-bold">{name}</p>
          {contact && (
            <a 
              href={`mailto:${contact}`}
              className="text-xs opacity-75 hover:opacity-100 flex items-center gap-1 mt-1"
            >
              <Mail className="h-3 w-3" />
              {contact}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
