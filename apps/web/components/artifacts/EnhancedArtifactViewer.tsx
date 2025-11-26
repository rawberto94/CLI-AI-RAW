'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FileText,
  DollarSign,
  Shield,
  AlertTriangle,
  FileCheck,
  Search,
  Download,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OverviewArtifact,
  ClausesArtifact,
  FinancialArtifact,
  RiskArtifact,
  ComplianceArtifact,
  MetricCard,
  ScoreRing
} from '@/components/artifacts/ArtifactCards'

// ============ TYPES ============

interface ArtifactData {
  overview?: any
  clauses?: any
  financial?: any
  risk?: any
  compliance?: any
  rates?: any
  // Legacy property names for backward compatibility
  keyClauses?: any
  financialAnalysis?: any
  riskAssessment?: any
  complianceCheck?: any
}

interface EnhancedArtifactViewerProps {
  artifacts: ArtifactData
  contractId: string
  initialTab?: string
  className?: string
}

// ============ TAB CONFIGURATION ============

const TABS = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: FileText,
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200'
  },
  { 
    id: 'clauses', 
    label: 'Clauses', 
    icon: FileCheck,
    color: 'indigo',
    gradient: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200'
  },
  { 
    id: 'financial', 
    label: 'Financial', 
    icon: DollarSign,
    color: 'emerald',
    gradient: 'from-emerald-500 to-green-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200'
  },
  { 
    id: 'risk', 
    label: 'Risk', 
    icon: AlertTriangle,
    color: 'amber',
    gradient: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200'
  },
  { 
    id: 'compliance', 
    label: 'Compliance', 
    icon: Shield,
    color: 'violet',
    gradient: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200'
  }
] as const;

type TabId = typeof TABS[number]['id'];

// ============ COMPONENT ============

export function EnhancedArtifactViewer({
  artifacts,
  contractId,
  initialTab = 'overview',
  className
}: EnhancedArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab as TabId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Normalize artifact data
  const normalizedData = useMemo(() => {
    return {
      overview: artifacts.overview || null,
      clauses: artifacts.clauses || artifacts.keyClauses || null,
      financial: artifacts.financial || artifacts.financialAnalysis || null,
      risk: artifacts.risk || artifacts.riskAssessment || null,
      compliance: artifacts.compliance || artifacts.complianceCheck || null,
      rates: artifacts.rates || null
    };
  }, [artifacts]);

  // Count available tabs
  const availableTabs = useMemo(() => {
    return TABS.filter(tab => {
      const data = normalizedData[tab.id as keyof typeof normalizedData];
      return data !== null && data !== undefined;
    });
  }, [normalizedData]);

  // Get current tab config
  const currentTab = TABS.find(t => t.id === activeTab) || TABS[0];
  const TabIcon = currentTab.icon;

  // Navigate tabs
  const goToNextTab = () => {
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    const nextIndex = (currentIndex + 1) % TABS.length;
    setActiveTab(TABS[nextIndex]?.id ?? TABS[0]!.id);
  };

  const goToPrevTab = () => {
    const currentIndex = TABS.findIndex(t => t.id === activeTab);
    const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    setActiveTab(TABS[prevIndex]?.id ?? TABS[0]!.id);
  };

  // Quick stats for header
  const stats = useMemo(() => {
    const riskScore = normalizedData.risk?.riskScore || normalizedData.risk?.overallScore || null;
    const complianceScore = normalizedData.compliance?.complianceScore || normalizedData.compliance?.score || null;
    const totalValue = normalizedData.financial?.totalValue || null;
    const clauseCount = normalizedData.clauses?.clauses?.length || 
                       normalizedData.clauses?.keyClauses?.length || 0;
    
    return { riskScore, complianceScore, totalValue, clauseCount };
  }, [normalizedData]);

  // Render tab content
  const renderTabContent = () => {
    const data = normalizedData[activeTab as keyof typeof normalizedData];
    
    if (!data) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <TabIcon className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No Data Available</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            This artifact has not been generated yet or no data was extracted.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewArtifact 
            data={{
              title: data.title || data.contractTitle,
              summary: data.summary,
              parties: data.parties,
              dates: {
                effective: data.effectiveDate || data.startDate,
                expiration: data.expirationDate || data.endDate || data.expiryDate,
                signed: data.signedDate || data.contractDate
              },
              keyTerms: data.keyTerms || data.terms,
              contractType: data.type || data.contractType,
              jurisdiction: data.jurisdiction,
              confidence: data.confidence
            }}
          />
        );
      
      case 'clauses':
        const clauses = data.clauses || data.keyClauses || [];
        return (
          <ClausesArtifact 
            data={{
              clauses: clauses.map((c: any, i: number) => ({
                id: c.id || `clause-${i}`,
                title: c.title || c.name || `Clause ${i + 1}`,
                content: c.content || c.text || c.description || '',
                type: c.type || c.category || 'General',
                importance: c.importance || c.priority || 'medium',
                obligations: c.obligations || [],
                risks: c.risks || c.riskFactors || []
              })),
              totalCount: clauses.length
            }}
          />
        );
      
      case 'financial':
        return (
          <FinancialArtifact 
            data={{
              totalValue: data.totalValue,
              currency: data.currency || 'USD',
              paymentTerms: data.paymentTerms,
              rates: data.rateCards || data.rates || normalizedData.rates?.rateCards || [],
              summary: data.summary || data.analysis
            }}
          />
        );
      
      case 'risk':
        const riskFactors = data.riskFactors || data.factors || data.risks || [];
        return (
          <RiskArtifact 
            data={{
              overallScore: data.riskScore || data.overallScore || 0,
              riskLevel: data.riskLevel || (data.riskScore > 70 ? 'high' : data.riskScore > 40 ? 'medium' : 'low'),
              factors: riskFactors.map((f: any, i: number) => ({
                id: f.id || `risk-${i}`,
                category: f.category || f.type || 'General',
                description: f.description || f.details || '',
                severity: f.severity || f.level || 'medium',
                mitigation: f.mitigation || f.recommendation
              })),
              summary: data.summary || data.assessment
            }}
          />
        );
      
      case 'compliance':
        const issues = data.issues || data.requirements || data.checks || [];
        return (
          <ComplianceArtifact 
            data={{
              score: data.complianceScore || data.score || 0,
              issues: issues.map((issue: any, i: number) => ({
                id: issue.id || `compliance-${i}`,
                regulation: issue.regulation || issue.standard || 'General',
                requirement: issue.requirement || issue.description || '',
                status: issue.status || (issue.compliant ? 'compliant' : 'non-compliant'),
                details: issue.details || issue.notes
              })),
              regulations: data.regulations || data.applicableRegulations || [],
              summary: data.summary
            }}
          />
        );
      
      default:
        return null;
    }
  };

  const containerClasses = cn(
    "relative",
    isFullscreen && "fixed inset-0 z-50 bg-white overflow-auto p-6",
    className
  );

  return (
    <div className={containerClasses}>
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.totalValue && (
          <MetricCard
            title="Contract Value"
            value={`$${(stats.totalValue / 1000).toFixed(0)}K`}
            icon={DollarSign}
            color="green"
          />
        )}
        
        {stats.clauseCount > 0 && (
          <MetricCard
            title="Key Clauses"
            value={stats.clauseCount}
            subtitle="Extracted"
            icon={FileCheck}
            color="blue"
          />
        )}
        
        {stats.riskScore !== null && (
          <MetricCard
            title="Risk Score"
            value={`${stats.riskScore}/100`}
            subtitle={stats.riskScore < 30 ? 'Low Risk' : stats.riskScore < 60 ? 'Medium' : 'High Risk'}
            icon={AlertTriangle}
            color={stats.riskScore < 30 ? 'green' : stats.riskScore < 60 ? 'amber' : 'rose'}
          />
        )}
        
        {stats.complianceScore !== null && (
          <MetricCard
            title="Compliance"
            value={`${stats.complianceScore}%`}
            subtitle="Score"
            icon={Shield}
            color={stats.complianceScore >= 90 ? 'green' : stats.complianceScore >= 70 ? 'amber' : 'rose'}
          />
        )}
      </div>

      {/* Tab Navigation */}
      <Card className="border-slate-200/80 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between px-4 py-2">
            {/* Tab Pills */}
            <div className="flex gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const hasData = normalizedData[tab.id as keyof typeof normalizedData] !== null;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={!hasData}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive 
                        ? cn("bg-white shadow-sm", tab.textColor)
                        : hasData
                        ? "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                        : "text-slate-300 cursor-not-allowed"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4",
                      isActive ? "" : hasData ? "text-slate-400" : "text-slate-300"
                    )} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className={cn(
                          "absolute -bottom-2.5 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r",
                          tab.gradient
                        )}
                      />
                    )}
                    
                    {/* No data indicator */}
                    {!hasData && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search in artifact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 pl-9 h-9 text-sm bg-white border-slate-200"
                />
              </div>
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-slate-500"
              >
                {isFullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>

        {/* Footer Navigation */}
        <div className="border-t border-slate-200 px-6 py-3 bg-slate-50/50 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevTab}
            className="text-slate-600"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  activeTab === tab.id 
                    ? cn("w-6 bg-gradient-to-r", tab.gradient)
                    : "bg-slate-300 hover:bg-slate-400"
                )}
              />
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextTab}
            className="text-slate-600"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default EnhancedArtifactViewer;
