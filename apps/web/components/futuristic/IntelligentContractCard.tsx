"use client";

import React, { useState } from 'react';
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  TrendingUp, 
  Shield, 
  Zap,
  Eye,
  MoreHorizontal,
  Star,
  ArrowRight,
  Brain
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ContractCardProps {
  contract: {
    id: string;
    title: string;
    type: string;
    parties: string[];
    value: number;
    currency: string;
    startDate: string;
    endDate: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    complianceScore: number;
    status: 'active' | 'expiring' | 'expired' | 'draft';
    aiInsights: Array<{
      type: 'opportunity' | 'risk' | 'recommendation';
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    keyMetrics: {
      paymentTerms: string;
      renewalDate?: string;
      autoRenewal: boolean;
      lastReviewed: string;
    };
    tags: string[];
    healthScore: number;
  };
  variant?: 'default' | 'compact' | 'detailed';
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onAnalyze?: (id: string) => void;
}

export function IntelligentContractCard({ 
  contract, 
  variant = 'default',
  onView,
  onEdit,
  onAnalyze 
}: ContractCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expiring': return 'bg-yellow-100 text-yellow-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getDaysUntilExpiration = () => {
    const today = new Date();
    const endDate = new Date(contract.endDate);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilExpiration = getDaysUntilExpiration();

  if (variant === 'compact') {
    return (
      <Card className="hover:shadow-md transition-all duration-200 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 truncate">{contract.title}</h4>
                <p className="text-sm text-gray-500">{contract.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getRiskColor(contract.riskLevel)}>
                {contract.riskLevel}
              </Badge>
              <span className="text-sm font-medium">
                {formatCurrency(contract.value, contract.currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`relative overflow-hidden transition-all duration-300 cursor-pointer ${
        isHovered ? 'shadow-xl scale-[1.02]' : 'shadow-md hover:shadow-lg'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 opacity-60"></div>
      
      {/* Risk Level Indicator */}
      <div className={`absolute top-0 right-0 w-16 h-16 ${
        contract.riskLevel === 'critical' ? 'bg-red-500' :
        contract.riskLevel === 'high' ? 'bg-red-400' :
        contract.riskLevel === 'medium' ? 'bg-yellow-400' :
        'bg-green-400'
      } opacity-20 rounded-bl-full`}></div>

      <CardContent className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {contract.title}
              </h3>
              <Badge className={getStatusColor(contract.status)}>
                {contract.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">{contract.type}</p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {contract.parties.length} parties
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {daysUntilExpiration > 0 ? `${daysUntilExpiration} days left` : 'Expired'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <DollarSign className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(contract.value, contract.currency)}
              </span>
            </div>
            <p className="text-xs text-gray-500">Contract Value</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Shield className="w-4 h-4 text-blue-600 mr-1" />
              <span className="text-lg font-bold text-gray-900">
                {contract.complianceScore}%
              </span>
            </div>
            <p className="text-xs text-gray-500">Compliance</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className={`w-4 h-4 mr-1 ${getHealthScoreColor(contract.healthScore)}`} />
              <span className={`text-lg font-bold ${getHealthScoreColor(contract.healthScore)}`}>
                {contract.healthScore}
              </span>
            </div>
            <p className="text-xs text-gray-500">Health Score</p>
          </div>
          
          <div className="text-center">
            <Badge className={getRiskColor(contract.riskLevel)}>
              <AlertTriangle className="w-3 h-3 mr-1" />
              {contract.riskLevel}
            </Badge>
            <p className="text-xs text-gray-500 mt-1">Risk Level</p>
          </div>
        </div>

        {/* Health Score Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Contract Health</span>
            <span className={`text-sm font-bold ${getHealthScoreColor(contract.healthScore)}`}>
              {contract.healthScore}/100
            </span>
          </div>
          <Progress 
            value={contract.healthScore} 
            className={`h-2 ${
              contract.healthScore >= 80 ? 'bg-green-100' :
              contract.healthScore >= 60 ? 'bg-yellow-100' :
              'bg-red-100'
            }`}
          />
        </div>

        {/* AI Insights Preview */}
        {contract.aiInsights.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-800 transition-colors"
            >
              <Brain className="w-4 h-4" />
              {contract.aiInsights.length} AI Insights
              <ArrowRight className={`w-3 h-3 transition-transform ${showInsights ? 'rotate-90' : ''}`} />
            </button>
            
            {showInsights && (
              <div className="mt-3 space-y-2">
                {contract.aiInsights.slice(0, 2).map((insight, index) => (
                  <div key={index} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-3 h-3 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">{insight.title}</span>
                      <Badge className={`text-xs ${
                        insight.priority === 'high' ? 'bg-red-100 text-red-700' :
                        insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {insight.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-purple-700">{insight.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        {contract.tags.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {contract.tags.slice(0, 4).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {contract.tags.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{contract.tags.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Key Details */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">Payment Terms:</span>
            <p className="font-medium">{contract.keyMetrics.paymentTerms}</p>
          </div>
          <div>
            <span className="text-gray-500">Auto Renewal:</span>
            <p className="font-medium">
              {contract.keyMetrics.autoRenewal ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Yes
                </span>
              ) : (
                <span className="text-gray-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Manual
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onView?.(contract.id)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onAnalyze?.(contract.id)}
            className="flex-1"
          >
            <Brain className="w-4 h-4 mr-2" />
            Analyze
          </Button>
          {contract.aiInsights.some(i => i.priority === 'high') && (
            <Button 
              size="sm" 
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              Act on Insights
            </Button>
          )}
        </div>

        {/* Hover Animation Elements */}
        {isHovered && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}