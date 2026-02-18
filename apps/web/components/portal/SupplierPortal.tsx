'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  FileText,
  MessageSquare,
  Upload,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Eye,
  Send,
  Paperclip,
  Calendar,
  Bell,
  Shield,
  Lock,
  ExternalLink,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  TrendingUp,
  FileCheck,
  AlertCircle,
  History,
  X,
} from 'lucide-react';

interface PortalContract {
  id: string;
  name: string;
  status: 'draft' | 'pending-review' | 'in-negotiation' | 'pending-signature' | 'active' | 'expired';
  type: string;
  value: number;
  startDate: string;
  endDate: string;
  lastUpdated: string;
  actionRequired: boolean;
  pendingItems: number;
}

interface Message {
  id: string;
  from: string;
  fromRole: 'supplier' | 'buyer';
  content: string;
  timestamp: string;
  attachments?: string[];
  read: boolean;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'requires-update';
  version: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed';
  type: 'document' | 'signature' | 'review' | 'information';
}

const mockContracts: PortalContract[] = [
  {
    id: 'c1',
    name: 'Master Services Agreement',
    status: 'pending-signature',
    type: 'MSA',
    value: 1200000,
    startDate: '2024-04-01',
    endDate: '2025-04-01',
    lastUpdated: '2 hours ago',
    actionRequired: true,
    pendingItems: 2,
  },
  {
    id: 'c2',
    name: 'Cloud Services SLA',
    status: 'in-negotiation',
    type: 'SLA',
    value: 450000,
    startDate: '2024-06-01',
    endDate: '2025-06-01',
    lastUpdated: '1 day ago',
    actionRequired: true,
    pendingItems: 1,
  },
  {
    id: 'c3',
    name: 'Professional Services SOW',
    status: 'active',
    type: 'SOW',
    value: 180000,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    lastUpdated: '1 week ago',
    actionRequired: false,
    pendingItems: 0,
  },
];

const mockMessages: Message[] = [
  {
    id: 'm1',
    from: 'Sarah Chen',
    fromRole: 'buyer',
    content: 'Hi, we have completed our legal review of the MSA. Please review our proposed changes to sections 3.2 and 7.1.',
    timestamp: '2024-03-14 09:30 AM',
    read: false,
  },
  {
    id: 'm2',
    from: 'You',
    fromRole: 'supplier',
    content: 'Thank you for the update. We will review the changes and respond by end of day.',
    timestamp: '2024-03-14 10:15 AM',
    read: true,
  },
  {
    id: 'm3',
    from: 'Mike Johnson',
    fromRole: 'buyer',
    content: 'Quick reminder that we need the updated insurance certificate before we can proceed with signature.',
    timestamp: '2024-03-13 02:45 PM',
    attachments: ['Insurance_Requirements.pdf'],
    read: true,
  },
];

const mockDocuments: Document[] = [
  {
    id: 'd1',
    name: 'Master Services Agreement v3.2.pdf',
    type: 'Contract',
    size: '2.4 MB',
    uploadedBy: 'ClientCo Legal',
    uploadedAt: '2024-03-14',
    status: 'pending',
    version: '3.2',
  },
  {
    id: 'd2',
    name: 'Certificate of Insurance 2024.pdf',
    type: 'Certificate',
    size: '890 KB',
    uploadedBy: 'You',
    uploadedAt: '2024-03-12',
    status: 'requires-update',
    version: '1.0',
  },
  {
    id: 'd3',
    name: 'W-9 Form.pdf',
    type: 'Tax Document',
    size: '156 KB',
    uploadedBy: 'You',
    uploadedAt: '2024-03-10',
    status: 'approved',
    version: '1.0',
  },
  {
    id: 'd4',
    name: 'Security Questionnaire Responses.xlsx',
    type: 'Compliance',
    size: '1.2 MB',
    uploadedBy: 'You',
    uploadedAt: '2024-03-08',
    status: 'approved',
    version: '2.0',
  },
];

const mockTasks: Task[] = [
  {
    id: 't1',
    title: 'Sign Master Services Agreement',
    description: 'Review and digitally sign the final MSA document',
    dueDate: '2024-03-15',
    priority: 'critical',
    status: 'pending',
    type: 'signature',
  },
  {
    id: 't2',
    title: 'Upload Updated Insurance Certificate',
    description: 'Provide certificate with updated coverage limits per Section 8.2',
    dueDate: '2024-03-16',
    priority: 'high',
    status: 'in-progress',
    type: 'document',
  },
  {
    id: 't3',
    title: 'Review SLA Amendment',
    description: 'Review proposed changes to service level metrics',
    dueDate: '2024-03-18',
    priority: 'medium',
    status: 'pending',
    type: 'review',
  },
  {
    id: 't4',
    title: 'Complete Vendor Questionnaire',
    description: 'Provide responses to annual vendor assessment',
    dueDate: '2024-03-25',
    priority: 'low',
    status: 'pending',
    type: 'information',
  },
];

const getStatusColor = (status: PortalContract['status']) => {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700';
    case 'pending-review':
      return 'bg-yellow-100 text-yellow-700';
    case 'in-negotiation':
      return 'bg-violet-100 text-violet-700';
    case 'pending-signature':
      return 'bg-violet-100 text-violet-700';
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'expired':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getDocStatusColor = (status: Document['status']) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-700';
    case 'approved':
      return 'bg-green-100 text-green-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'requires-update':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getPriorityColor = (priority: Task['priority']) => {
  switch (priority) {
    case 'critical':
      return 'text-red-600 bg-red-50';
    case 'high':
      return 'text-orange-600 bg-orange-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'low':
      return 'text-gray-600 bg-gray-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

interface SupplierPortalProps {
  supplierId?: string;
  tenantId?: string;
  contractId?: string;
}

export function SupplierPortal({ supplierId, tenantId, contractId }: SupplierPortalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'documents' | 'messages' | 'tasks'>('overview');
  const [selectedContract, setSelectedContract] = useState<string | null>(contractId || null);
  const [newMessage, setNewMessage] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLoading, setIsLoading] = useState(!!supplierId);
  const [portalData, setPortalData] = useState<{
    supplier: typeof supplierInfo;
    contracts: PortalContract[];
    tasks: Task[];
    messages: Message[];
    documents: Document[];
  } | null>(null);

  // Fetch real data if supplierId is provided
  useEffect(() => {
    if (supplierId) {
      fetchPortalData();
    }
  }, [supplierId, tenantId]);

  const fetchPortalData = async () => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('portalToken');
      const res = await fetch(`/api/portal?supplierId=${supplierId}&token=${token}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        // Map API data to component format
        setPortalData({
          supplier: {
            name: data.data.supplier?.name || 'Unknown Supplier',
            contact: 'Contact via Portal',
            email: '',
            phone: '',
            address: '',
            rating: 4.5,
            activeContracts: data.data.contracts?.length || 0,
            totalValue: data.data.contracts?.reduce((sum: number, c: { value?: number }) => sum + (c.value || 0), 0) || 0,
            relationship: 'Active',
          },
          contracts: (data.data.contracts || []).map((c: PortalContract) => ({
            ...c,
            type: 'Contract',
            startDate: new Date().toISOString().split('T')[0],
            endDate: (c as any).expiryDate || new Date().toISOString().split('T')[0],
            lastUpdated: 'Recently',
            pendingItems: c.actionRequired ? 1 : 0,
          })),
          tasks: (data.data.pendingTasks || []).map((t: Task) => ({
            ...t,
            description: t.title,
            status: 'pending',
          })),
          messages: data.data.messages || [],
          documents: data.data.documents || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const supplierInfo = portalData?.supplier || {
    name: 'TechVendor Solutions Inc.',
    contact: 'John Smith',
    email: 'john.smith@techvendor.com',
    phone: '+1 (555) 123-4567',
    address: '123 Tech Avenue, San Francisco, CA 94105',
    rating: 4.7,
    activeContracts: 3,
    totalValue: 1830000,
    relationship: '3 years',
  };

  const tasks = portalData?.tasks || [];
  const messages = portalData?.messages || [];
  const contracts = portalData?.contracts || [];
  const documents = portalData?.documents || [];

  const pendingActions = tasks.filter(t => t.status !== 'completed').length;
  const unreadMessages = messages.filter(m => !m.read && m.fromRole === 'buyer').length;

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading portal data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-violet-600" />
                <div>
                  <h1 className="font-bold text-gray-900">Supplier Portal</h1>
                  <p className="text-xs text-gray-500">Powered by ClientCo</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                  <Bell className="h-5 w-5" />
                  {(pendingActions + unreadMessages) > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {pendingActions + unreadMessages}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-violet-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  JS
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">John Smith</p>
                  <p className="text-xs text-gray-500">{supplierInfo.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Building2 },
              { id: 'contracts', label: 'Contracts', icon: FileText },
              { id: 'documents', label: 'Documents', icon: Paperclip },
              { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
              { id: 'tasks', label: 'Tasks', icon: CheckCircle2, badge: pendingActions },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-4 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome back, John!</h2>
                  <p className="text-violet-100">
                    You have {pendingActions} pending actions and {unreadMessages} unread messages.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-violet-200 text-sm">Relationship since</p>
                  <p className="text-xl font-semibold">{supplierInfo.relationship}</p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-violet-100 rounded-lg">
                    <FileText className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{supplierInfo.activeContracts}</p>
                    <p className="text-sm text-gray-500">Active Contracts</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(supplierInfo.totalValue / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-sm text-gray-500">Total Contract Value</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Star className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{supplierInfo.rating}</p>
                    <p className="text-sm text-gray-500">Performance Rating</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-violet-100 rounded-lg">
                    <FileCheck className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">98%</p>
                    <p className="text-sm text-gray-500">Compliance Score</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Urgent Actions */}
            {tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold text-gray-900">Urgent Actions Required</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {tasks
                    .filter(t => t.priority === 'critical' || t.priority === 'high')
                    .map((task) => (
                      <div key={task.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${getPriorityColor(task.priority)}`}>
                            {task.type === 'signature' && <Edit3 className="h-4 w-4" />}
                            {task.type === 'document' && <Upload className="h-4 w-4" />}
                            {task.type === 'review' && <Eye className="h-4 w-4" />}
                            {task.type === 'information' && <FileText className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{task.title}</p>
                            <p className="text-sm text-gray-500">{task.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Due</p>
                            <p className="font-medium text-gray-900">{task.dueDate}</p>
                          </div>
                          <button className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                            Take Action
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Contracts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Active Contracts</h3>
                  <button
                    onClick={() => setActiveTab('contracts')}
                    className="text-sm text-violet-600 hover:text-violet-700"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {contracts.slice(0, 3).map((contract) => (
                    <div key={contract.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{contract.name}</p>
                          {contract.actionRequired && (
                            <span className="h-2 w-2 bg-red-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          ${contract.value.toLocaleString()} • Expires {contract.endDate}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                        {contract.status.replace('-', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Messages */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Recent Messages</h3>
                  <button
                    onClick={() => setActiveTab('messages')}
                    className="text-sm text-violet-600 hover:text-violet-700"
                  >
                    View all
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {messages.slice(0, 3).map((message) => (
                    <div
                      key={message.id}
                      className={`px-6 py-4 hover:bg-gray-50 ${!message.read && message.fromRole === 'buyer' ? 'bg-violet-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          message.fromRole === 'buyer' ? 'bg-violet-500' : 'bg-gray-400'
                        }`}>
                          {message.from.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{message.from}</p>
                            <span className="text-xs text-gray-400">{message.timestamp}</span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{message.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Your Contracts</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contracts..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                  <Filter className="h-4 w-4" />
                  Filter
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contract
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{contract.name}</span>
                          {contract.actionRequired && (
                            <span className="h-2 w-2 bg-red-500 rounded-full" title="Action required" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">Last updated {contract.lastUpdated}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{contract.type}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        ${contract.value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {contract.startDate} - {contract.endDate}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                          {contract.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <Download className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Documents</h2>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm"
              >
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <FileText className="h-5 w-5 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{doc.name}</p>
                            <p className="text-sm text-gray-500">{doc.size} • v{doc.version}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{doc.type}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{doc.uploadedAt}</p>
                        <p className="text-sm text-gray-500">by {doc.uploadedBy}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getDocStatusColor(doc.status)}`}>
                          {doc.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <Download className="h-4 w-4" />
                          </button>
                          {doc.status === 'requires-update' && (
                            <button className="p-2 text-violet-600 hover:text-violet-700 rounded-lg hover:bg-violet-50">
                              <Upload className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Messages</h2>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`p-6 ${!message.read && message.fromRole === 'buyer' ? 'bg-violet-50' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${
                        message.fromRole === 'buyer' ? 'bg-violet-500' : 'bg-gray-400'
                      }`}>
                        {message.from.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">{message.from}</span>
                          <span className="text-sm text-gray-400">{message.timestamp}</span>
                          {!message.read && message.fromRole === 'buyer' && (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-600 text-xs rounded-full">New</span>
                          )}
                        </div>
                        <p className="mt-2 text-gray-700">{message.content}</p>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.attachments.map((attachment, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                              >
                                <Paperclip className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700">{attachment}</span>
                                <button className="text-violet-600 hover:text-violet-700">
                                  <Download className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-500">
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <button className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Pending Tasks</h2>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
              {tasks.map((task) => (
                <div key={task.id} className="p-6 flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${getPriorityColor(task.priority)}`}>
                    {task.type === 'signature' && <Edit3 className="h-5 w-5" />}
                    {task.type === 'document' && <Upload className="h-5 w-5" />}
                    {task.type === 'review' && <Eye className="h-5 w-5" />}
                    {task.type === 'information' && <FileText className="h-5 w-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        Due: {task.dueDate}
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        task.status === 'in-progress' ? 'bg-violet-100 text-violet-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                    {task.type === 'signature' ? 'Sign Now' :
                     task.type === 'document' ? 'Upload' :
                     task.type === 'review' ? 'Review' : 'Complete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div key="upload-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
                <p className="text-sm text-gray-400">PDF, DOC, DOCX, XLS, XLSX up to 25MB</p>
                <input type="file" className="hidden" />
                <button className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                  Select Files
                </button>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                  Upload
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
