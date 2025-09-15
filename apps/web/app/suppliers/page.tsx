"use client";
import React, { useState } from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  Star, 
  DollarSign, 
  FileText, 
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  MapPin
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';

type Supplier = {
  id: string;
  name: string;
  category: string;
  location: string;
  riskScore: number;
  complianceRate: number;
  activeContracts: number;
  totalValue: number;
  lastAudit: string;
  performance: 'excellent' | 'good' | 'average' | 'poor';
  trend: 'up' | 'down' | 'stable';
  status: 'active' | 'pending' | 'suspended';
  contact: {
    email: string;
    phone: string;
  };
};

const mockSuppliers: Supplier[] = [
  {
    id: '1',
    name: 'TechConsult Global',
    category: 'IT Services',
    location: 'London, UK',
    riskScore: 85,
    complianceRate: 94,
    activeContracts: 3,
    totalValue: 2400000,
    lastAudit: '2024-08-15',
    performance: 'excellent',
    trend: 'up',
    status: 'active',
    contact: {
      email: 'procurement@techconsult.com',
      phone: '+44 20 1234 5678'
    }
  },
  {
    id: '2',
    name: 'Marketing Dynamics',
    category: 'Marketing & Creative',
    location: 'New York, US',
    riskScore: 72,
    complianceRate: 89,
    activeContracts: 2,
    totalValue: 850000,
    lastAudit: '2024-07-22',
    performance: 'good',
    trend: 'stable',
    status: 'active',
    contact: {
      email: 'contracts@marketingdynamics.com',
      phone: '+1 212 555 0123'
    }
  },
  {
    id: '3',
    name: 'SecureAudit Pro',
    category: 'Legal & Compliance',
    location: 'Frankfurt, DE',
    riskScore: 91,
    complianceRate: 98,
    activeContracts: 1,
    totalValue: 450000,
    lastAudit: '2024-09-01',
    performance: 'excellent',
    trend: 'up',
    status: 'active',
    contact: {
      email: 'legal@secureaudit.de',
      phone: '+49 69 1234 5678'
    }
  }
];

const getRiskColor = (score: number) => {
  if (score >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
  if (score >= 60) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
  return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
};

const getPerformanceColor = (performance: string) => {
  switch (performance) {
    case 'excellent': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
    case 'good': return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
    case 'average': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
    case 'poor': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
    default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
  }
};

const TrendIcon = ({ trend }: { trend: string }) => {
  switch (trend) {
    case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
    default: return <Minus className="w-4 h-4 text-gray-500" />;
  }
};

export default function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  const categories = ['all', 'IT Services', 'Marketing & Creative', 'Legal & Compliance'];
  
  const statusOptions = Array.from(new Set(mockSuppliers.map(s => s.status)));

  const filteredSuppliers = mockSuppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         supplier.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || supplier.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || supplier.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-2"><BackButton hrefFallback="/" /></div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Building2 className="w-8 h-8 mr-3 text-indigo-600" />
            Supplier Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor supplier performance, risk scores, and compliance across your procurement portfolio
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <Building2 className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Suppliers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{mockSuppliers.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Contract Value</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${(mockSuppliers.reduce((sum, s) => sum + s.totalValue, 0) / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <Star className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Risk Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(mockSuppliers.reduce((sum, s) => sum + s.riskScore, 0) / mockSuppliers.length)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Compliance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(mockSuppliers.reduce((sum, s) => sum + s.complianceRate, 0) / mockSuppliers.length)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Status</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All</option>
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Supplier</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Category</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Risk Score</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Compliance</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Performance</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Contracts</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Total Value</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-4 px-6">
                      <div>
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mr-3">
                            <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <MapPin className="w-3 h-3 mr-1" />
                              {supplier.location}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-900 dark:text-white">{supplier.category}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(supplier.riskScore)}`}>
                          {supplier.riskScore}
                        </span>
                        <TrendIcon trend={supplier.trend} />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-gray-900 dark:text-white font-medium">{supplier.complianceRate}%</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getPerformanceColor(supplier.performance)}`}>
                        {supplier.performance}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-900 dark:text-white">{supplier.activeContracts}</td>
                    <td className="py-4 px-6 text-gray-900 dark:text-white font-medium">
                      ${(supplier.totalValue / 1000000).toFixed(1)}M
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex space-x-2">
                        <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium">
                          View Profile
                        </button>
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
