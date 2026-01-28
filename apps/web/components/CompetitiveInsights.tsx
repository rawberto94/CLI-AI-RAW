"use client";

import React, { useState } from 'react';
import { 
  Info, 
  X, 
  TrendingUp, 
  Zap, 
  Shield, 
  Target,
  Award,
  Lightbulb,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Calculator,
  Building
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CompetitiveInsight {
  id: string;
  title: string;
  category: 'speed' | 'intelligence' | 'integration' | 'value' | 'security';
  vsCompetitor: string;
  ourAdvantage: string;
  quantifiedBenefit: string;
  keyMessage: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const competitiveInsights: CompetitiveInsight[] = [
  {
    id: 'speed-advantage',
    title: '10x Faster Than Traditional CLM',
    category: 'speed',
    vsCompetitor: 'Traditional CLM vendors (Icertis, Agiloft) require manual folder searches taking hours',
    ourAdvantage: 'Natural language queries with instant answers in 1.2 seconds',
    quantifiedBenefit: '60-80% reduction in contract review time',
    keyMessage: 'Turn your contracts from static documents into intelligent assets',
    icon: Zap,
    color: 'blue'
  },
  {
    id: 'intelligence-advantage',
    title: 'Purpose-Built Contract AI',
    category: 'intelligence',
    vsCompetitor: 'Legal tech startups (Kira, eBrevia) offer single-point solutions with limited business intelligence',
    ourAdvantage: 'End-to-end contract lifecycle with AI-powered business optimization',
    quantifiedBenefit: '$2.4M average annual savings identified',
    keyMessage: 'Beyond extraction - complete contract intelligence for business value',
    icon: Target,
    color: 'purple'
  },
  {
    id: 'integration-advantage',
    title: 'No Rip-and-Replace Required',
    category: 'integration',
    vsCompetitor: 'Big Tech solutions (Microsoft Syntex, Google) require system overhauls',
    ourAdvantage: 'Works seamlessly with existing SharePoint, Ariba, Icertis, APADUA',
    quantifiedBenefit: '6-8 week pilot vs 6-12 month implementations',
    keyMessage: 'Immediate value without disrupting existing workflows',
    icon: Shield,
    color: 'green'
  },
  {
    id: 'value-advantage',
    title: 'Quantified ROI from Day One',
    category: 'value',
    vsCompetitor: 'Generic AI solutions provide insights without business context',
    ourAdvantage: 'Contract-native AI with domain expertise and benchmarking',
    quantifiedBenefit: '95% compliance detection vs 60% manual processes',
    keyMessage: 'Contract-native AI that understands your business, not just documents',
    icon: TrendingUp,
    color: 'orange'
  },
  {
    id: 'security-advantage',
    title: 'Enterprise-Grade Security',
    category: 'security',
    vsCompetitor: 'Startups lack enterprise security and compliance frameworks',
    ourAdvantage: 'Microsoft-native with tenant isolation, private endpoints, full audit trails',
    quantifiedBenefit: 'Zero cross-tenant leakage with EU/CH residency compliance',
    keyMessage: 'Enterprise security without compromising AI capabilities',
    icon: Award,
    color: 'red'
  }
];

interface CompetitiveTooltipProps {
  insight: CompetitiveInsight;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const CompetitiveTooltip: React.FC<CompetitiveTooltipProps> = ({ 
  insight, 
  children, 
  position = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'border-violet-200 bg-violet-50 text-violet-900',
      purple: 'border-purple-200 bg-purple-50 text-purple-900',
      green: 'border-green-200 bg-green-50 text-green-900',
      orange: 'border-orange-200 bg-orange-50 text-orange-900',
      red: 'border-red-200 bg-red-50 text-red-900'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getPositionClasses = () => {
    const positions = {
      top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
    };
    return positions[position];
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      
      {isVisible && (
        <div className={`absolute z-50 w-80 ${getPositionClasses()}`}>
          <Card className={`shadow-lg border-2 ${getColorClasses(insight.color)}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <insight.icon className="w-4 h-4" />
                {insight.title}
                <Badge variant="outline" className="ml-auto text-xs">
                  Competitive Edge
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="text-xs font-medium text-red-700">Competitor Weakness:</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-slate-300">{insight.vsCompetitor}</p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span className="text-xs font-medium text-green-700">Our Advantage:</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-slate-300">{insight.ourAdvantage}</p>
              </div>
              
              <div className={`p-2 rounded border ${getColorClasses(insight.color)}`}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-semibold">Quantified Benefit:</span>
                </div>
                <p className="text-xs font-medium">{insight.quantifiedBenefit}</p>
              </div>
              
              <div className="border-t pt-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs font-medium">Key Message:</span>
                </div>
                <p className="text-xs italic text-gray-600 dark:text-slate-400 mt-1">&ldquo;{insight.keyMessage}&rdquo;</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

interface CompetitivePopupProps {
  isOpen: boolean;
  onClose: () => void;
  demoType: 'ask-evidence' | 'rate-normalization' | 'compliance-check' | 'supplier-snapshot';
}

export const CompetitivePopup: React.FC<CompetitivePopupProps> = ({ 
  isOpen, 
  onClose, 
  demoType 
}) => {
  if (!isOpen) return null;

  const getCompetitiveData = () => {
    switch (demoType) {
      case 'ask-evidence':
        return {
          title: 'Ask with Evidence - Competitive Advantage',
          icon: Zap,
          color: 'blue',
          advantages: [
            {
              competitor: 'Traditional CLM (Icertis, Agiloft)',
              weakness: 'Manual folder searches, keyword matching, hours of review',
              ourSolution: 'Natural language queries with AI understanding and instant results',
              benefit: '10x faster contract intelligence'
            },
            {
              competitor: 'Legal Tech (Kira, eBrevia)',
              weakness: 'Document extraction only, no business context',
              ourSolution: 'Business-aware AI with savings calculations and recommendations',
              benefit: '$135K savings identified instantly'
            },
            {
              competitor: 'Big Tech (Microsoft Syntex)',
              weakness: 'Generic AI without contract domain expertise',
              ourSolution: 'Purpose-built contract AI with legal and business intelligence',
              benefit: '80%+ accuracy with full audit trail'
            }
          ],
          keyMessage: 'Turn static contract repositories into intelligent, queryable business assets'
        };
      
      case 'rate-normalization':
        return {
          title: 'Rate Normalization - Market Leadership',
          icon: Calculator,
          color: 'green',
          advantages: [
            {
              competitor: 'Manual Excel Analysis',
              weakness: 'Weeks of work, error-prone, outdated benchmarks',
              ourSolution: 'Automated normalization with real-time market data',
              benefit: '847 rates processed vs weeks of manual work'
            },
            {
              competitor: 'Procurement Tools (Ariba Analytics)',
              weakness: 'Historical data, no AI insights, limited benchmarking',
              ourSolution: 'AI-powered rate intelligence with p50/p75/p90 benchmarks',
              benefit: '$77K annual savings opportunity identified'
            },
            {
              competitor: 'Consulting Services',
              weakness: 'Expensive, slow, one-time analysis',
              ourSolution: 'Continuous automated analysis with instant insights',
              benefit: 'Real-time rate optimization vs quarterly reviews'
            }
          ],
          keyMessage: 'Transform rate management from reactive analysis to proactive optimization'
        };
      
      case 'compliance-check':
        return {
          title: 'Compliance Automation - Risk Leadership',
          icon: Shield,
          color: 'purple',
          advantages: [
            {
              competitor: 'Manual Compliance Reviews',
              weakness: '10% coverage, quarterly checks, human error',
              ourSolution: '100% continuous monitoring with AI classification',
              benefit: '95% compliance detection vs 60% manual'
            },
            {
              competitor: 'Legal Review Services',
              weakness: 'Expensive, slow, inconsistent standards',
              ourSolution: 'Automated policy application with specific remediation',
              benefit: '80% risk reduction through continuous monitoring'
            },
            {
              competitor: 'Compliance Software (MetricStream)',
              weakness: 'Generic rules, no contract intelligence',
              ourSolution: 'Contract-native compliance with AI understanding',
              benefit: 'Specific remediation steps, not just alerts'
            }
          ],
          keyMessage: 'Continuous compliance monitoring that catches issues before they become problems'
        };
      
      case 'supplier-snapshot':
        return {
          title: 'Supplier Intelligence - Portfolio Mastery',
          icon: Building,
          color: 'orange',
          advantages: [
            {
              competitor: 'Manual Supplier Analysis',
              weakness: '2 weeks prep time, outdated data, incomplete view',
              ourSolution: 'Multi-contract analysis in 2.3 seconds with current benchmarks',
              benefit: '$180K savings potential identified instantly'
            },
            {
              competitor: 'Procurement Analytics',
              weakness: 'Spend data only, no contract intelligence',
              ourSolution: 'Complete contract portfolio view with clause analysis',
              benefit: 'Negotiation-ready insights with specific talking points'
            },
            {
              competitor: 'Consulting Negotiation Support',
              weakness: 'Expensive, generic templates, slow turnaround',
              ourSolution: 'AI-generated negotiation packs with supplier-specific insights',
              benefit: 'One-click negotiation preparation vs weeks of analysis'
            }
          ],
          keyMessage: 'Transform supplier relationships from reactive management to strategic optimization'
        };
      
      default:
        return null;
    }
  };

  const data = getCompetitiveData();
  if (!data) return null;

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-100',
      green: 'border-green-500 bg-gradient-to-br from-violet-50 to-purple-100',
      purple: 'border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100',
      orange: 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto border-2 ${getColorClasses(data.color)}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <data.icon className="w-6 h-6" />
              {data.title}
              <Badge className="bg-white/80 text-gray-800">
                Competitive Analysis
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            {data.advantages.map((advantage, index) => (
              <Card key={index} className="bg-white/80 border border-gray-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Competitor Weakness */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="font-semibold text-red-700 text-sm">
                          {advantage.competitor}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-300">{advantage.weakness}</p>
                    </div>
                    
                    {/* Our Solution */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-semibold text-green-700 text-sm">
                          Chain IQ Solution
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-slate-300">{advantage.ourSolution}</p>
                    </div>
                    
                    {/* Quantified Benefit */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-violet-500" />
                        <span className="font-semibold text-violet-700 text-sm">
                          Quantified Benefit
                        </span>
                      </div>
                      <p className="text-sm font-medium text-violet-800">{advantage.benefit}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Key Message */}
          <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                <div>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">Key Competitive Message:</span>
                  <p className="text-gray-700 dark:text-slate-300 italic mt-1">&ldquo;{data.keyMessage}&rdquo;</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close Analysis
            </Button>
            <Button className="bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              <ArrowRight className="w-4 h-4 mr-2" />
              Continue Demo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Competitive insight button component
interface CompetitiveInsightButtonProps {
  demoType: 'ask-evidence' | 'rate-normalization' | 'compliance-check' | 'supplier-snapshot';
  onShowInsights: (type: 'ask-evidence' | 'rate-normalization' | 'compliance-check' | 'supplier-snapshot') => void;
}

export const CompetitiveInsightButton: React.FC<CompetitiveInsightButtonProps> = ({ 
  demoType, 
  onShowInsights 
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onShowInsights(demoType)}
      className="bg-gradient-to-r from-yellow-50 to-orange-50 border-orange-200 text-orange-700 hover:from-orange-50 hover:to-orange-100"
    >
      <Award className="w-4 h-4 mr-2" />
      Why We Win
      <ArrowRight className="w-3 h-3 ml-1" />
    </Button>
  );
};

export { competitiveInsights };