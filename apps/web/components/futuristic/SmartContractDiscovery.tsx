"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  Brain, 
  Zap, 
  FileText, 
  Calendar, 
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Eye,
  Star,
  Clock,
  Users,
  Shield,
  ChevronDown,
  X,
  Wand2,
  Lightbulb,
  Target
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDataMode } from '@/contexts/DataModeContext';

interface SmartFilter {
  id: string;
  name: string;
  type: 'select' | 'range' | 'date' | 'boolean';
  icon: React.ReactNode;
  options?: string[];
  value?: any;
  aiSuggested?: boolean;
}

interface ContractCard {
  id: string;
  title: string;
  type: string;
  client: string;
  vendor: string;
  value: number;
  currency: string;
  status: string;
  riskScore: number;
  complianceScore: number;
  expirationDate: string;
  tags: string[];
  aiInsights: string[];
  similarity?: number;
  relevanceScore?: number;
}

export function SmartContractDiscovery() {
  const { isMockData } = useDataMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [contracts, setContracts] = useState<ContractCard[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<ContractCard[]>([]);
  const [activeFilters, setActiveFilters] = useState<SmartFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mock data fallback
  const mockContracts: ContractCard[] = [
    {
      id: '1',
      title: 'Master Service Agreement - Cloud Infrastructure',
      type: 'MSA',
      client: 'TechCorp Inc.',
      vendor: 'CloudProvider LLC',
      value: 2400000,
      currency: 'USD',
      status: 'active',
      riskScore: 25,
      complianceScore: 94,
      expirationDate: '2025-12-31',
      tags: ['cloud', 'infrastructure', 'high-value', 'multi-year'],
      aiInsights: ['Strong liability protection', 'Favorable payment terms', 'Auto-renewal clause present'],
      relevanceScore: 98
    },
    {
      id: '2',
      title: 'Software Development Agreement - Mobile App',
      type: 'SOW',
      client: 'StartupCo',
      vendor: 'DevStudio Inc.',
      value: 850000,
      currency: 'USD',
      status: 'active',
      riskScore: 45,
      complianceScore: 87,
      expirationDate: '2024-06-30',
      tags: ['software', 'mobile', 'development', 'fixed-price'],
      aiInsights: ['IP ownership clearly defined', 'Milestone-based payments', 'Limited warranty period'],
      relevanceScore: 92
    },
    {
      id: '3',
      title: 'Data Processing Agreement - Analytics Platform',
      type: 'DPA',
      client: 'DataCorp',
      vendor: 'AnalyticsPro',
      value: 1200000,
      currency: 'USD',
      status: 'pending_renewal',
      riskScore: 35,
      complianceScore: 96,
      expirationDate: '2024-04-15',
      tags: ['data', 'analytics', 'gdpr-compliant', 'enterprise'],
      aiInsights: ['GDPR compliant', 'Data retention policies clear', 'Strong security requirements'],
      relevanceScore: 89
    }
  ];

  // Fetch contracts from API or use mock data based on mode
  useEffect(() => {
    async function fetchContracts() {
      // If in demo mode, always use mock data
      if (isMockData) {
        setContracts(mockContracts);
        setFilteredContracts(mockContracts);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch('/api/contracts/list');
        const json = await res.json();
        if (json.success && json.data?.contracts?.length > 0) {
          const mapped = json.data.contracts.map((c: any) => ({
            id: c.id,
            title: c.contractName || c.name || c.fileName || 'Contract',
            type: c.contractType || 'Contract',
            client: c.parties?.[0] || 'Unknown',
            vendor: c.counterparty || c.vendor || c.parties?.[1] || 'Unknown',
            value: c.contractValue || c.value || 0,
            currency: 'USD',
            status: c.status?.toLowerCase() || 'active',
            riskScore: c.riskScore || 30,
            complianceScore: c.complianceScore || 90,
            expirationDate: c.endDate || c.expirationDate || '2025-12-31',
            tags: c.tags || [],
            aiInsights: c.insights || [],
            relevanceScore: 85
          }));
          setContracts(mapped);
          setFilteredContracts(mapped);
        } else {
          setContracts(mockContracts);
          setFilteredContracts(mockContracts);
        }
      } catch (error) {
        console.log('Using mock contracts data');
        setContracts(mockContracts);
        setFilteredContracts(mockContracts);
      } finally {
        setLoading(false);
      }
    }
    fetchContracts();
  }, [isMockData]);

  // AI-powered search suggestions
  useEffect(() => {
    if (searchQuery.length > 2) {
      setIsSearching(true);
      // Simulate AI processing
      setTimeout(() => {
        const suggestions = [
          'Show me high-value technology contracts',
          'Find contracts expiring in Q2 2024',
          'Display agreements with liability concerns',
          'Show cloud service agreements'
        ];
        setAiSuggestions(suggestions);
        setIsSearching(false);
      }, 800);
    } else {
      setAiSuggestions([]);
    }
  }, [searchQuery]);

  const smartFilters: SmartFilter[] = [
    {
      id: 'type',
      name: 'Contract Type',
      type: 'select',
      icon: <FileText className="w-4 h-4" />,
      options: ['MSA', 'SOW', 'NDA', 'DPA', 'SLA']
    },
    {
      id: 'value',
      name: 'Contract Value',
      type: 'range',
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      id: 'risk',
      name: 'Risk Level',
      type: 'select',
      icon: <AlertTriangle className="w-4 h-4" />,
      options: ['Low (0-30)', 'Medium (31-60)', 'High (61-100)'],
      aiSuggested: true
    },
    {
      id: 'expiration',
      name: 'Expiration Date',
      type: 'date',
      icon: <Calendar className="w-4 h-4" />,
      aiSuggested: true
    },
    {
      id: 'status',
      name: 'Status',
      type: 'select',
      icon: <Target className="w-4 h-4" />,
      options: ['active', 'pending_renewal', 'expired', 'terminated']
    }
  ];

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      // Simulate AI-powered search
      const filtered = contracts.filter(contract => 
        contract.title.toLowerCase().includes(query.toLowerCase()) ||
        contract.client.toLowerCase().includes(query.toLowerCase()) ||
        contract.vendor.toLowerCase().includes(query.toLowerCase()) ||
        contract.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredContracts(filtered);
    } else {
      setFilteredContracts(contracts);
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'text-green-600 bg-green-50';
    if (score <= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'pending_renewal': return 'text-yellow-600 bg-yellow-50';
      case 'expired': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-purple-500 animate-pulse mx-auto mb-3" />
          <p className="text-slate-600">Loading contract intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI-Powered Search Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Brain className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Smart Contract Discovery</h1>
            <p className="text-blue-100">AI-powered search and intelligent contract insights</p>
          </div>
        </div>
        
        {/* Smart Search Bar */}
        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ask me anything about your contracts... (e.g., 'Show high-risk cloud agreements')"
                className="w-full pl-12 pr-16 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <Sparkles className="w-5 h-5 text-white animate-pulse" />
                </div>
              )}
            </div>
            
            <Button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-white/20 hover:bg-white/30 border-white/20 text-white px-6 py-4"
            >
              <Filter className="w-5 h-5 mr-2" />
              Smart Filters
              {activeFilters.length > 0 && (
                <Badge className="ml-2 bg-white/30 text-white">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </div>
          
          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-xl border border-white/20 shadow-xl z-10">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-700">AI Suggestions</span>
                </div>
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSearch(suggestion)}
                      className="w-full text-left p-3 rounded-lg hover:bg-blue-50 text-gray-700 text-sm transition-colors"
                    >
                      <Wand2 className="w-3 h-3 inline mr-2 text-purple-500" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Smart Filters Panel */}
      {showFilters && (
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Intelligent Filters
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {smartFilters.map((filter) => (
                <div key={filter.id} className="relative">
                  <button className="w-full p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left">
                    <div className="flex items-center gap-2 mb-1">
                      {filter.icon}
                      <span className="font-medium text-gray-900">{filter.name}</span>
                      {filter.aiSuggested && (
                        <Sparkles className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
            
            {/* AI Filter Suggestions */}
            <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">AI Recommendations</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  High-risk contracts
                </Badge>
                <Badge className="bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200">
                  <Calendar className="w-3 h-3 mr-1" />
                  Expiring soon
                </Badge>
                <Badge className="bg-green-100 text-green-800 cursor-pointer hover:bg-green-200">
                  <DollarSign className="w-3 h-3 mr-1" />
                  High-value deals
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {filteredContracts.length} Contracts Found
          </h2>
          {searchQuery && (
            <Badge className="bg-blue-100 text-blue-800">
              <Search className="w-3 h-3 mr-1" />
              "{searchQuery}"
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {/* Contract Cards */}
      <div className={`grid gap-6 ${
        viewMode === 'grid' 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1'
      }`}>
        {filteredContracts.map((contract) => (
          <Card key={contract.id} className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-300 bg-gradient-to-br from-white to-gray-50">
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {contract.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-100 text-blue-800">
                      {contract.type}
                    </Badge>
                    <Badge className={getStatusColor(contract.status)}>
                      {contract.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                
                {contract.relevanceScore && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Relevance</div>
                    <div className="text-lg font-bold text-blue-600">
                      {contract.relevanceScore}%
                    </div>
                  </div>
                )}
              </div>
              
              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Client</div>
                  <div className="font-medium text-gray-900">{contract.client}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Vendor</div>
                  <div className="font-medium text-gray-900">{contract.vendor}</div>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(contract.value, contract.currency)}
                  </div>
                  <div className="text-xs text-gray-500">Value</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${getRiskColor(contract.riskScore).split(' ')[0]}`}>
                    {contract.riskScore}
                  </div>
                  <div className="text-xs text-gray-500">Risk Score</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {contract.complianceScore}%
                  </div>
                  <div className="text-xs text-gray-500">Compliance</div>
                </div>
              </div>
              
              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {contract.tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} className="text-xs bg-gray-100 text-gray-700">
                    {tag}
                  </Badge>
                ))}
                {contract.tags.length > 3 && (
                  <Badge className="text-xs bg-gray-100 text-gray-700">
                    +{contract.tags.length - 3} more
                  </Badge>
                )}
              </div>
              
              {/* AI Insights */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">AI Insights</span>
                </div>
                <div className="space-y-1">
                  {contract.aiInsights.slice(0, 2).map((insight, index) => (
                    <div key={index} className="text-xs text-purple-700 flex items-start gap-1">
                      <div className="w-1 h-1 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      {insight}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  Expires {new Date(contract.expirationDate).toLocaleDateString()}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="group-hover:border-blue-300">
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Star className="w-4 h-4 mr-1" />
                    Analyze
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Empty State */}
      {filteredContracts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contracts found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
          <Button onClick={() => { setSearchQuery(''); setFilteredContracts(contracts); }}>
            Clear Search
          </Button>
        </div>
      )}
    </div>
  );
}