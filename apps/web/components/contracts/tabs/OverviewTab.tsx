'use client'

import { motion } from 'framer-motion'
import { 
  Calendar, 
  DollarSign, 
  Users, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Share2,
  Edit,
  Trash2,
  Copy,
  ExternalLink
} from 'lucide-react'
import { fadeIn, staggerContainer } from '@/lib/contracts/animations'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

export interface ContractMetadata {
  id: string
  title: string
  status: 'active' | 'pending' | 'expired' | 'terminated'
  type: string
  startDate: Date
  endDate: Date
  value: number
  currency: string
  client: string
  supplier: string
  owner: string
  department: string
  riskScore?: number
  complianceScore?: number
}

export interface OverviewTabProps {
  contract: ContractMetadata
  onEdit?: () => void
  onDelete?: () => void
  onDownload?: () => void
  onShare?: () => void
  onDuplicate?: () => void
  className?: string
}

export function OverviewTab({
  contract,
  onEdit,
  onDelete,
  onDownload,
  onShare,
  onDuplicate,
  className
}: OverviewTabProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'expired':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'terminated':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getRiskColor = (score?: number) => {
    if (!score) return 'text-gray-500'
    if (score >= 80) return 'text-red-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-green-600'
  }

  const daysUntilExpiry = Math.ceil(
    (contract.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={cn('space-y-6', className)}
    >
      {/* Header with Quick Actions */}
      <motion.div variants={fadeIn} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{contract.title}</h2>
          <div className="flex items-center gap-3 mt-2">
            <span className={cn(
              'px-3 py-1 text-sm font-medium rounded-full border',
              getStatusColor(contract.status)
            )}>
              {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
            </span>
            <span className="text-sm text-gray-500">
              {contract.type}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Duplicate"
            >
              <Copy className="w-5 h-5 text-gray-600" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5 text-red-600" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Key Metrics Cards */}
      <motion.div variants={fadeIn} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Contract Value */}
        <MetricCard
          icon={DollarSign}
          label="Contract Value"
          value={formatCurrency(contract.value, contract.currency)}
          iconColor="text-green-600"
          bgColor="bg-green-50"
        />

        {/* Duration */}
        <MetricCard
          icon={Calendar}
          label="Duration"
          value={`${Math.ceil((contract.endDate.getTime() - contract.startDate.getTime()) / (1000 * 60 * 60 * 24))} days`}
          subtitle={`${formatDate(contract.startDate)} - ${formatDate(contract.endDate)}`}
          iconColor="text-violet-600"
          bgColor="bg-violet-50"
        />

        {/* Days Until Expiry */}
        <MetricCard
          icon={Clock}
          label="Days Until Expiry"
          value={daysUntilExpiry > 0 ? daysUntilExpiry.toString() : 'Expired'}
          subtitle={daysUntilExpiry > 0 && daysUntilExpiry < 90 ? 'Renewal needed soon' : undefined}
          iconColor={daysUntilExpiry < 90 ? 'text-yellow-600' : 'text-gray-600'}
          bgColor={daysUntilExpiry < 90 ? 'bg-yellow-50' : 'bg-gray-50'}
          alert={daysUntilExpiry < 90}
        />

        {/* Risk Score */}
        {contract.riskScore !== undefined && (
          <MetricCard
            icon={AlertCircle}
            label="Risk Score"
            value={`${contract.riskScore}/100`}
            iconColor={getRiskColor(contract.riskScore)}
            bgColor={contract.riskScore >= 80 ? 'bg-red-50' : contract.riskScore >= 50 ? 'bg-yellow-50' : 'bg-green-50'}
            alert={contract.riskScore >= 80}
          />
        )}
      </motion.div>

      {/* Contract Details */}
      <motion.div variants={fadeIn} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Parties */}
        <DetailCard title="Parties" icon={Users}>
          <div className="space-y-4">
            <DetailRow label="Client" value={contract.client} />
            <DetailRow label="Supplier" value={contract.supplier} />
            <DetailRow label="Contract Owner" value={contract.owner} />
            <DetailRow label="Department" value={contract.department} />
          </div>
        </DetailCard>

        {/* Contract Information */}
        <DetailCard title="Contract Information" icon={FileText}>
          <div className="space-y-4">
            <DetailRow label="Contract ID" value={contract.id} />
            <DetailRow label="Type" value={contract.type} />
            <DetailRow label="Status" value={contract.status} />
            <DetailRow 
              label="Start Date" 
              value={formatDate(contract.startDate)} 
            />
            <DetailRow 
              label="End Date" 
              value={formatDate(contract.endDate)} 
            />
          </div>
        </DetailCard>
      </motion.div>

      {/* Compliance Score */}
      {contract.complianceScore !== undefined && (
        <motion.div variants={fadeIn}>
          <DetailCard title="Compliance Status" icon={CheckCircle}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Overall Compliance Score
                </span>
                <span className={cn(
                  'text-2xl font-bold',
                  contract.complianceScore >= 80 ? 'text-green-600' :
                  contract.complianceScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {contract.complianceScore}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <motion.div
                  className={cn(
                    'h-3 rounded-full',
                    contract.complianceScore >= 80 ? 'bg-green-600' :
                    contract.complianceScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${contract.complianceScore}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
          </DetailCard>
        </motion.div>
      )}

      {/* Related Documents */}
      <motion.div variants={fadeIn}>
        <DetailCard title="Related Documents" icon={FileText}>
          <div className="space-y-2">
            <DocumentLink name="Original Contract.pdf" size="2.4 MB" />
            <DocumentLink name="Amendment 1.pdf" size="1.2 MB" />
            <DocumentLink name="Addendum.pdf" size="856 KB" />
          </div>
        </DetailCard>
      </motion.div>
    </motion.div>
  )
}

// Helper Components
interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtitle?: string
  iconColor: string
  bgColor: string
  alert?: boolean
}

function MetricCard({ icon: Icon, label, value, subtitle, iconColor, bgColor, alert }: MetricCardProps) {
  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all hover:shadow-md',
      alert ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn('p-2 rounded-lg', bgColor)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
    </div>
  )
}

interface DetailCardProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}

function DetailCard({ title, icon: Icon, children }: DetailCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

interface DocumentLinkProps {
  name: string
  size: string
}

function DocumentLink({ name, size }: DocumentLinkProps) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group">
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4 text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">{size}</p>
        </div>
      </div>
      <button className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ExternalLink className="w-4 h-4 text-gray-400 hover:text-gray-600" />
      </button>
    </div>
  )
}
