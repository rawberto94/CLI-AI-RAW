"use client";
import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  Tag,
  TrendingUp,
  Users,
  Building
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';

type ComplianceRule = {
  id: string;
  name: string;
  category: 'GDPR' | 'Anti-Bribery' | 'Company Policy' | 'Financial' | 'Security';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'deprecated';
};

type ComplianceResult = {
  id: string;
  contractId: string;
  contractName: string;
  supplier: string;
  ruleId: string;
  ruleName: string;
  status: 'pass' | 'warn' | 'fail';
  evidence: string;
  lastChecked: string;
  category: string;
};

const mockRules: ComplianceRule[] = [
  {
    id: '1',
    name: 'GDPR Data Processing Clause',
    category: 'GDPR',
    description: 'Ensure contracts contain proper GDPR data processing terms',
    severity: 'critical',
    status: 'active'
  },
  {
    id: '2',
    name: 'Anti-Bribery Declaration',
    category: 'Anti-Bribery',
    description: 'Supplier must declare compliance with anti-bribery laws',
    severity: 'critical',
    status: 'active'
  },
  {
    id: '3',
    name: 'Maximum Contract Duration',
    category: 'Company Policy',
    description: 'Contract duration must not exceed 3 years without approval',
    severity: 'medium',
    status: 'active'
  },
  {
    id: '4',
    name: 'Security Standards Compliance',
    category: 'Security',
    description: 'Supplier must meet ISO 27001 or equivalent security standards',
    severity: 'high',
    status: 'active'
  }
];

const mockResults: ComplianceResult[] = [
  {
    id: '1',
    contractId: 'CNT-001',
    contractName: 'TechConsult Global - IT Services',
    supplier: 'TechConsult Global',
    ruleId: '1',
    ruleName: 'GDPR Data Processing Clause',
    status: 'pass',
    evidence: 'Section 4.2: Data Processing Terms comply with GDPR Article 28',
    lastChecked: '2024-09-02',
    category: 'GDPR'
  },
  {
    id: '2',
    contractId: 'CNT-002',
    contractName: 'Marketing Dynamics - Campaign Services',
    supplier: 'Marketing Dynamics',
    ruleId: '2',
    ruleName: 'Anti-Bribery Declaration',
    status: 'warn',
    evidence: 'Anti-bribery clause present but lacks specific jurisdiction details',
    lastChecked: '2024-09-01',
    category: 'Anti-Bribery'
  },
  {
    id: '3',
    contractId: 'CNT-003',
    contractName: 'SecureAudit Pro - Compliance Review',
    supplier: 'SecureAudit Pro',
    ruleId: '3',
    ruleName: 'Maximum Contract Duration',
    status: 'fail',
    evidence: 'Contract duration is 5 years, exceeds 3-year policy limit',
    lastChecked: '2024-09-02',
    category: 'Company Policy'
  }
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
    case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
    case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
    default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pass': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
    case 'warn': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
    case 'fail': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
    default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
  }
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'pass': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'warn': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'fail': return <XCircle className="w-5 h-5 text-red-500" />;
    default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
  }
};

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'results' | 'rules'>('results');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'GDPR', 'Anti-Bribery', 'Company Policy', 'Security', 'Financial'];
  
  const passCount = mockResults.filter(r => r.status === 'pass').length;
  const warnCount = mockResults.filter(r => r.status === 'warn').length;
  const failCount = mockResults.filter(r => r.status === 'fail').length;
  const totalCount = mockResults.length;
  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const filteredResults = mockResults.filter(result => {
    const matchesSearch = result.contractName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.ruleName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || result.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredRules = mockRules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div className="mb-2"><BackButton hrefFallback="/" /></div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <ShieldAlert className="w-8 h-8 mr-3 text-indigo-600" />
            Compliance Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor contract compliance across GDPR, anti-bribery, security, and company policies
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Compliance Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{passRate}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Passed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{passCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Warnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{warnCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <XCircle className="w-8 h-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{failCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('results')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'results'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Compliance Results
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'rules'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                Rule Management
              </button>
            </nav>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={activeTab === 'results' ? "Search contracts or rules..." : "Search rules..."}
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
          </div>
        </div>

        {/* Content */}
        {activeTab === 'results' ? (
          /* Compliance Results Table */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Status</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Contract</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Rule</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Category</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Evidence</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Last Checked</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredResults.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <StatusIcon status={result.status} />
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(result.status)}`}>
                            {result.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{result.contractName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{result.supplier}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-900 dark:text-white">{result.ruleName}</td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {result.category}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {result.evidence}
                      </td>
                      <td className="py-4 px-6 text-gray-900 dark:text-white">
                        {new Date(result.lastChecked).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Rules Management Table */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Rule Name</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Category</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Severity</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Status</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Description</th>
                    <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-4 px-6 font-medium text-gray-900 dark:text-white">{rule.name}</td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {rule.category}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getSeverityColor(rule.severity)}`}>
                          {rule.severity}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${rule.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                          {rule.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                        {rule.description}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex space-x-2">
                          <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium">
                            Edit
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
        )}
      </div>
    </div>
  );
}
