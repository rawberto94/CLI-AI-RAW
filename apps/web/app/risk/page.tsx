"use client";
import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  DollarSign,
  Clock,
  Building2,
  Target,
  Activity
} from 'lucide-react';
import { BackButton } from '@/components/ui/back-button';

type RiskFactor = {
  id: string;
  name: string;
  weight: number;
  category: 'financial' | 'operational' | 'legal' | 'compliance' | 'strategic';
};

type ContractRisk = {
  id: string;
  contractId: string;
  contractName: string;
  supplier: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    financial: number;
    operational: number;
    legal: number;
    compliance: number;
    strategic: number;
  };
  keyRisks: string[];
  lastAssessment: string;
  mitigation: string;
  trend: 'improving' | 'stable' | 'deteriorating';
  contractValue: number;
  expiryDate: string;
};

const mockRiskFactors: RiskFactor[] = [
  { id: '1', name: 'Termination Notice Period', weight: 0.15, category: 'operational' },
  { id: '2', name: 'Liability Cap Adequacy', weight: 0.20, category: 'financial' },
  { id: '3', name: 'Data Protection Compliance', weight: 0.18, category: 'compliance' },
  { id: '4', name: 'Single Source Dependency', weight: 0.12, category: 'strategic' },
  { id: '5', name: 'Payment Terms Risk', weight: 0.10, category: 'financial' },
  { id: '6', name: 'IP Ownership Clarity', weight: 0.15, category: 'legal' },
  { id: '7', name: 'SLA Enforceability', weight: 0.10, category: 'operational' }
];

const mockContractRisks: ContractRisk[] = [
  {
    id: '1',
    contractId: 'CNT-001',
    contractName: 'TechConsult Global - IT Services',
    supplier: 'TechConsult Global',
    overallScore: 75,
    riskLevel: 'medium',
    factors: {
      financial: 80,
      operational: 70,
      legal: 75,
      compliance: 85,
      strategic: 65
    },
    keyRisks: [
      'Limited termination notice (30 days)',
      'Single source for critical systems',
      'No penalty clauses for SLA breaches'
    ],
    lastAssessment: '2024-09-01',
    mitigation: 'Negotiate extended notice period, identify backup suppliers',
    trend: 'stable',
    contractValue: 2400000,
    expiryDate: '2025-12-31'
  },
  {
    id: '2',
    contractId: 'CNT-002',
    contractName: 'Marketing Dynamics - Campaign Services',
    supplier: 'Marketing Dynamics',
    overallScore: 45,
    riskLevel: 'high',
    factors: {
      financial: 40,
      operational: 50,
      legal: 35,
      compliance: 60,
      strategic: 40
    },
    keyRisks: [
      'No liability cap defined',
      'Unclear IP ownership terms',
      'Weak data protection clauses',
      'No termination for convenience'
    ],
    lastAssessment: '2024-08-28',
    mitigation: 'Legal review required, renegotiate key terms',
    trend: 'deteriorating',
    contractValue: 850000,
    expiryDate: '2025-06-30'
  },
  {
    id: '3',
    contractId: 'CNT-003',
    contractName: 'SecureAudit Pro - Compliance Review',
    supplier: 'SecureAudit Pro',
    overallScore: 90,
    riskLevel: 'low',
    factors: {
      financial: 95,
      operational: 85,
      legal: 90,
      compliance: 95,
      strategic: 85
    },
    keyRisks: [
      'Minor: Rate escalation above market'
    ],
    lastAssessment: '2024-09-02',
    mitigation: 'Monitor rate benchmarks quarterly',
    trend: 'improving',
    contractValue: 450000,
    expiryDate: '2026-03-31'
  }
];

const getRiskLevelColor = (level: string) => {
  switch (level) {
    case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
    case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
    case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-200';
    case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
    default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
  }
};

const getRiskScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
};

const TrendIcon = ({ trend }: { trend: string }) => {
  switch (trend) {
    case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'deteriorating': return <TrendingDown className="w-4 h-4 text-red-500" />;
    default: return <Activity className="w-4 h-4 text-gray-500" />;
  }
};

export default function RiskPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  
  const riskLevels = ['all', 'low', 'medium', 'high', 'critical'];
  
  const inferType = (name: string) => {
    const nm = name.toLowerCase();
    if (/(^|\b)msa\b|master service/.test(nm)) return 'MSA';
    if (/\bsow\b|statement of work/.test(nm)) return 'SOW';
    if (/\bpo\b|purchase order/.test(nm)) return 'PO';
    if (/order form/.test(nm)) return 'Order Form';
    return 'Unknown';
  };

  const supplierOptions = Array.from(new Set(mockContractRisks.map(r => r.supplier))).sort();
  const typeOptions = Array.from(new Set(mockContractRisks.map(r => inferType(r.contractName)))).sort();

  const filteredRisks = mockContractRisks.filter(risk => {
    const matchesSearch = risk.contractName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         risk.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = selectedRiskLevel === 'all' || risk.riskLevel === selectedRiskLevel;
    const matchesSupplier = selectedSupplier === 'all' || risk.supplier === selectedSupplier;
    const matchesType = selectedType === 'all' || inferType(risk.contractName) === selectedType;
    return matchesSearch && matchesLevel && matchesSupplier && matchesType;
  });

  const avgRiskScore = Math.round(mockContractRisks.reduce((sum, r) => sum + r.overallScore, 0) / mockContractRisks.length);
  const highRiskCount = mockContractRisks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
  const totalValue = mockContractRisks.reduce((sum, r) => sum + r.contractValue, 0);
  const riskValue = mockContractRisks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical')
    .reduce((sum, r) => sum + r.contractValue, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div className="mb-2"><BackButton hrefFallback="/" /></div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <AlertTriangle className="w-8 h-8 mr-3 text-indigo-600" />
            Risk Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Monitor and manage contract risks across financial, operational, legal, and compliance dimensions
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Risk Score</p>
                <p className={`text-2xl font-bold ${getRiskScoreColor(avgRiskScore)}`}>{avgRiskScore}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">High Risk Contracts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{highRiskCount}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Value at Risk</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${(riskValue / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Portfolio Coverage</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round((1 - riskValue / totalValue) * 100)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Heatmap */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Factor Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries({
              'Financial': mockContractRisks.reduce((sum, r) => sum + r.factors.financial, 0) / mockContractRisks.length,
              'Operational': mockContractRisks.reduce((sum, r) => sum + r.factors.operational, 0) / mockContractRisks.length,
              'Legal': mockContractRisks.reduce((sum, r) => sum + r.factors.legal, 0) / mockContractRisks.length,
              'Compliance': mockContractRisks.reduce((sum, r) => sum + r.factors.compliance, 0) / mockContractRisks.length,
              'Strategic': mockContractRisks.reduce((sum, r) => sum + r.factors.strategic, 0) / mockContractRisks.length,
            }).map(([category, score]) => (
              <div key={category} className="text-center">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{category}</div>
                <div className={`text-2xl font-bold ${getRiskScoreColor(score)}`}>
                  {Math.round(score)}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                    style={{ inlineSize: `${score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search contracts or suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={selectedRiskLevel}
                onChange={(e) => setSelectedRiskLevel(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {riskLevels.map(level => (
                  <option key={level} value={level}>
                    {level === 'all' ? 'All Risk Levels' : `${level.charAt(0).toUpperCase() + level.slice(1)} Risk`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Supplier</span>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All</option>
                {supplierOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Type</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All</option>
                {typeOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {(selectedSupplier !== 'all' || selectedType !== 'all' || selectedRiskLevel !== 'all' || searchTerm) && (
              <button
                onClick={() => { setSelectedSupplier('all'); setSelectedType('all'); setSelectedRiskLevel('all'); setSearchTerm(''); }}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Risk Assessment Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Contract</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Risk Score</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Level</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Trend</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Key Risks</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Value</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Expiry</th>
                  <th className="text-left py-4 px-6 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRisks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{risk.contractName}</p>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Building2 className="w-3 h-3 mr-1" />
                          {risk.supplier}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <span className={`text-2xl font-bold ${getRiskScoreColor(risk.overallScore)}`}>
                          {risk.overallScore}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">/100</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getRiskLevelColor(risk.riskLevel)}`}>
                        {risk.riskLevel}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-1">
                        <TrendIcon trend={risk.trend} />
                        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{risk.trend}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                        <ul className="list-disc list-inside space-y-1">
                          {risk.keyRisks.slice(0, 2).map((keyRisk, idx) => (
                            <li key={idx} className="truncate">{keyRisk}</li>
                          ))}
                          {risk.keyRisks.length > 2 && (
                            <li className="text-indigo-600 dark:text-indigo-400">+{risk.keyRisks.length - 2} more</li>
                          )}
                        </ul>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-900 dark:text-white font-medium">
                      ${(risk.contractValue / 1000000).toFixed(1)}M
                    </td>
                    <td className="py-4 px-6 text-gray-900 dark:text-white">
                      {new Date(risk.expiryDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex space-x-2">
                        <button className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium">
                          View Report
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
