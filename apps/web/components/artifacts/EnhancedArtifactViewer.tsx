'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
  TrendingUp,
  Edit3,
  Save,
  Eye,
  Wand2,
  Clock,
  Calendar,
  Scale,
  History,
  Users,
  Ban,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Target,
  Bookmark,
  BookmarkPlus,
  Keyboard,
  FileDown,
  CalendarDays,
  LayoutList,
  ListChecks,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  OverviewArtifact,
  ClausesArtifact,
  FinancialArtifact,
  RiskArtifact,
  ComplianceArtifact,
  ObligationsArtifact,
  RenewalArtifact,
  NegotiationPointsArtifact,
  AmendmentsArtifact,
  ContactsArtifact,
  MetricCard,
  ScoreRing
} from '@/components/artifacts/ArtifactCards'
import { ArtifactFeedback } from '@/components/artifacts/ArtifactFeedback'
import { SmartEditableArtifact, convertToEditableSections } from '@/components/artifacts/SmartEditableArtifact'

// ============ CONTRACT TYPE HELPERS (Client-side) ============

type ContractType = 'NDA' | 'MSA' | 'SOW' | 'SLA' | 'EMPLOYMENT' | 'LEASE' | 'LICENSE' | 'PURCHASE' | 'PARTNERSHIP' | 'CONSULTING' | 'SUBSCRIPTION' | 'LOAN' | 'SETTLEMENT' | 'OTHER';

// Tab priority by contract type - most important tabs first
const TAB_PRIORITY_BY_TYPE: Record<ContractType, string[]> = {
  NDA: ['overview', 'clauses', 'risk', 'obligations', 'negotiationPoints', 'compliance'],
  MSA: ['overview', 'clauses', 'financial', 'risk', 'compliance', 'obligations', 'renewal', 'negotiationPoints'],
  SOW: ['overview', 'financial', 'clauses', 'obligations', 'risk', 'compliance'],
  SLA: ['overview', 'compliance', 'clauses', 'financial', 'risk', 'obligations', 'renewal'],
  EMPLOYMENT: ['overview', 'financial', 'clauses', 'obligations', 'compliance', 'risk'],
  LEASE: ['overview', 'financial', 'clauses', 'renewal', 'obligations', 'risk', 'compliance'],
  LICENSE: ['overview', 'clauses', 'financial', 'compliance', 'risk', 'renewal', 'obligations'],
  PURCHASE: ['overview', 'financial', 'clauses', 'compliance', 'risk', 'obligations'],
  PARTNERSHIP: ['overview', 'clauses', 'financial', 'risk', 'obligations', 'compliance'],
  CONSULTING: ['overview', 'financial', 'clauses', 'obligations', 'risk', 'compliance'],
  SUBSCRIPTION: ['overview', 'financial', 'renewal', 'clauses', 'compliance', 'risk'],
  LOAN: ['overview', 'financial', 'clauses', 'risk', 'compliance', 'obligations'],
  SETTLEMENT: ['overview', 'clauses', 'financial', 'obligations', 'compliance'],
  OTHER: ['overview', 'clauses', 'financial', 'risk', 'compliance', 'obligations', 'renewal', 'negotiationPoints', 'amendments', 'contacts']
};

// Contract type insights for UI display
const CONTRACT_INSIGHTS: Record<ContractType, { typicalDuration: string; keyFocus: string[] }> = {
  NDA: { typicalDuration: '1-5 years', keyFocus: ['Confidentiality scope', 'Duration', 'Permitted disclosures'] },
  MSA: { typicalDuration: '2-5 years', keyFocus: ['Liability caps', 'IP rights', 'Change orders'] },
  SOW: { typicalDuration: '3-18 months', keyFocus: ['Deliverables', 'Milestones', 'Acceptance criteria'] },
  SLA: { typicalDuration: '1-3 years', keyFocus: ['Uptime targets', 'Credits', 'Exclusions'] },
  EMPLOYMENT: { typicalDuration: 'At-will/Fixed', keyFocus: ['Compensation', 'Non-compete', 'IP assignment'] },
  LEASE: { typicalDuration: '1-10 years', keyFocus: ['Rent terms', 'Maintenance', 'Renewal options'] },
  LICENSE: { typicalDuration: '1-5 years', keyFocus: ['Usage rights', 'Restrictions', 'Audit rights'] },
  PURCHASE: { typicalDuration: 'Transaction', keyFocus: ['Payment terms', 'Delivery', 'Warranty'] },
  PARTNERSHIP: { typicalDuration: '3-10 years', keyFocus: ['Profit sharing', 'Governance', 'Exit rights'] },
  CONSULTING: { typicalDuration: '3-12 months', keyFocus: ['Rates', 'Scope', 'Deliverables'] },
  SUBSCRIPTION: { typicalDuration: '1-3 years', keyFocus: ['Auto-renewal', 'Price increases', 'Cancellation'] },
  LOAN: { typicalDuration: '1-30 years', keyFocus: ['Interest rate', 'Prepayment', 'Covenants'] },
  SETTLEMENT: { typicalDuration: 'One-time', keyFocus: ['Release scope', 'Payment timing', 'Confidentiality'] },
  OTHER: { typicalDuration: 'Varies', keyFocus: ['Core terms', 'Obligations', 'Termination'] }
};

// ============ TYPES ============

interface ArtifactData {
  overview?: any
  clauses?: any
  financial?: any
  risk?: any
  compliance?: any
  rates?: any
  obligations?: any
  renewal?: any
  negotiationPoints?: any
  amendments?: any
  contacts?: any
  // Legacy property names for backward compatibility
  keyClauses?: any
  financialAnalysis?: any
  riskAssessment?: any
  complianceCheck?: any
}

interface EnhancedArtifactViewerProps {
  artifacts: ArtifactData
  contractId: string
  /** Map of artifact type (lowercase) → artifact database ID for feedback/export */
  artifactIds?: Record<string, string>
  /** When true, shows loading skeletons for tabs without data yet */
  isProcessing?: boolean
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
    gradient: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200'
  },
  { 
    id: 'clauses', 
    label: 'Clauses', 
    icon: FileCheck,
    color: 'indigo',
    gradient: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-indigo-200'
  },
  { 
    id: 'financial', 
    label: 'Financial', 
    icon: DollarSign,
    color: 'violet',
    gradient: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200'
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
  },
  { 
    id: 'obligations', 
    label: 'Obligations', 
    icon: Clock,
    color: 'purple',
    gradient: 'from-violet-500 to-fuchsia-500',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200'
  },
  { 
    id: 'renewal', 
    label: 'Renewal', 
    icon: Calendar,
    color: 'teal',
    gradient: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200'
  },
  { 
    id: 'negotiationPoints', 
    label: 'Negotiation', 
    icon: Scale,
    color: 'pink',
    gradient: 'from-pink-500 to-rose-500',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200'
  },
  { 
    id: 'amendments', 
    label: 'Amendments', 
    icon: History,
    color: 'slate',
    gradient: 'from-slate-500 to-gray-500',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200'
  },
  { 
    id: 'contacts', 
    label: 'Contacts', 
    icon: Users,
    color: 'sky',
    gradient: 'from-sky-500 to-purple-500',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200'
  }
] as const;

type TabId = typeof TABS[number]['id'];

// ============ COMPONENT ============

export function EnhancedArtifactViewer({
  artifacts,
  contractId,
  artifactIds = {},
  isProcessing = false,
  initialTab = 'overview',
  className
}: EnhancedArtifactViewerProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab as TabId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showActionItems, setShowActionItems] = useState(false);
  const [bookmarkedClauses, setBookmarkedClauses] = useState<Set<string>>(new Set());
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize artifact data with not-applicable detection
  const normalizedData = useMemo(() => {
    return {
      overview: artifacts.overview || null,
      clauses: artifacts.clauses || artifacts.keyClauses || null,
      financial: artifacts.financial || artifacts.financialAnalysis || null,
      risk: artifacts.risk || artifacts.riskAssessment || null,
      compliance: artifacts.compliance || artifacts.complianceCheck || null,
      rates: artifacts.rates || null,
      obligations: artifacts.obligations || null,
      renewal: artifacts.renewal || null,
      negotiationPoints: artifacts.negotiationPoints || null,
      amendments: artifacts.amendments || null,
      contacts: artifacts.contacts || null
    };
  }, [artifacts]);

  // Extract extraction metadata to determine applicability
  const extractionMeta = useMemo(() => {
    const meta: Record<string, { isApplicable: boolean; contractType: string; confidence: number }> = {};
    
    Object.entries(artifacts).forEach(([key, artifact]) => {
      if (artifact && typeof artifact === 'object' && '_extractionMeta' in artifact) {
        const extractionInfo = artifact._extractionMeta as any;
        meta[key] = {
          isApplicable: extractionInfo?.isApplicable ?? true,
          contractType: extractionInfo?.contractType ?? 'OTHER',
          confidence: extractionInfo?.confidence ?? 1.0
        };
      }
    });
    
    return meta;
  }, [artifacts]);

  // Detected contract type from any artifact
  const detectedContractType = useMemo((): ContractType => {
    const firstMeta = Object.values(extractionMeta)[0];
    const type = firstMeta?.contractType || 'OTHER';
    return type as ContractType;
  }, [extractionMeta]);

  // Get contract type insights
  const contractInsights = useMemo(() => {
    return CONTRACT_INSIGHTS[detectedContractType] || CONTRACT_INSIGHTS.OTHER;
  }, [detectedContractType]);

  // Convert to editable sections for edit mode
  const editableSections = useMemo(() => {
    return convertToEditableSections(artifacts, 'contract');
  }, [artifacts]);

  // Sort tabs by priority for this contract type
  const sortedTabs = useMemo(() => {
    const priority = TAB_PRIORITY_BY_TYPE[detectedContractType] || TAB_PRIORITY_BY_TYPE.OTHER;
    return [...TABS].sort((a, b) => {
      const aIndex = priority.indexOf(a.id);
      const bIndex = priority.indexOf(b.id);
      // If not in priority list, put at end
      const aPos = aIndex === -1 ? 999 : aIndex;
      const bPos = bIndex === -1 ? 999 : bIndex;
      return aPos - bPos;
    });
  }, [detectedContractType]);

  // Count available tabs - includes not-applicable for visibility
  const availableTabs = useMemo(() => {
    return sortedTabs.filter(tab => {
      const data = normalizedData[tab.id as keyof typeof normalizedData];
      // Show tabs that have data OR are explicitly marked as not-applicable
      return data !== null && data !== undefined;
    });
  }, [normalizedData, sortedTabs]);

  // Check if a tab is not applicable for this contract type
  const isTabNotApplicable = (tabId: string): boolean => {
    const artifact = (artifacts as Record<string, unknown>)[tabId] || 
                     (artifacts as Record<string, unknown>)[tabId + 'Analysis'] || 
                     (artifacts as Record<string, unknown>)[tabId + 'Assessment'];
    if (artifact && typeof artifact === 'object') {
      const meta = (artifact as { _extractionMeta?: { isApplicable?: boolean; notApplicable?: boolean } })._extractionMeta;
      return meta?.isApplicable === false || meta?.notApplicable === true;
    }
    return false;
  };

  // Generate smart suggestions based on extracted data
  const smartSuggestions = useMemo(() => {
    const suggestions: { category: string; suggestion: string; priority: 'high' | 'medium' | 'low' }[] = [];
    
    // Check for missing important fields
    if (!normalizedData.overview?.parties || normalizedData.overview.parties.length === 0) {
      suggestions.push({
        category: 'Missing Data',
        suggestion: 'No parties identified. Verify party names and roles are clearly stated.',
        priority: 'high'
      });
    }
    
    if (!normalizedData.overview?.effectiveDate && !normalizedData.overview?.startDate) {
      suggestions.push({
        category: 'Missing Data',
        suggestion: 'No effective date found. This is critical for determining contract validity.',
        priority: 'high'
      });
    }
    
    // Risk-based suggestions
    const riskScore = normalizedData.risk?.riskScore || normalizedData.risk?.overallScore;
    if (riskScore && riskScore > 70) {
      suggestions.push({
        category: 'Risk Alert',
        suggestion: 'High risk score detected. Legal review recommended before signing.',
        priority: 'high'
      });
    }
    
    // Compliance suggestions
    const complianceScore = normalizedData.compliance?.complianceScore || normalizedData.compliance?.score;
    if (complianceScore && complianceScore < 70) {
      suggestions.push({
        category: 'Compliance',
        suggestion: 'Low compliance score. Review regulatory requirements and missing provisions.',
        priority: 'medium'
      });
    }
    
    // Type-specific suggestions
    if (detectedContractType === 'NDA' && !normalizedData.clauses?.clauses?.some((c: any) => 
      c.title?.toLowerCase().includes('return') || c.title?.toLowerCase().includes('destruction')
    )) {
      suggestions.push({
        category: 'Best Practice',
        suggestion: 'Consider adding provisions for return/destruction of confidential information.',
        priority: 'medium'
      });
    }
    
    if (detectedContractType === 'SUBSCRIPTION' && !normalizedData.renewal?.autoRenewal) {
      suggestions.push({
        category: 'Attention',
        suggestion: 'No auto-renewal terms found. Verify renewal process is clearly defined.',
        priority: 'medium'
      });
    }
    
    if (['MSA', 'SOW', 'CONSULTING'].includes(detectedContractType) && !normalizedData.financial?.totalValue) {
      suggestions.push({
        category: 'Financial',
        suggestion: 'No total contract value identified. Review pricing terms carefully.',
        priority: 'medium'
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [normalizedData, detectedContractType]);

  // Cross-artifact search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return null;
    
    const query = searchQuery.toLowerCase();
    const results: { tab: string; field: string; value: string; context: string }[] = [];
    
    const searchInObject = (obj: any, path: string, tabId: string) => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('_')) continue; // Skip metadata
        
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string' && value.toLowerCase().includes(query)) {
          results.push({
            tab: tabId,
            field: key,
            value: value.substring(0, 100) + (value.length > 100 ? '...' : ''),
            context: currentPath
          });
        } else if (Array.isArray(value)) {
          value.forEach((item, i) => {
            if (typeof item === 'string' && item.toLowerCase().includes(query)) {
              results.push({
                tab: tabId,
                field: `${key}[${i}]`,
                value: item.substring(0, 100) + (item.length > 100 ? '...' : ''),
                context: `${currentPath}[${i}]`
              });
            } else if (typeof item === 'object') {
              searchInObject(item, `${currentPath}[${i}]`, tabId);
            }
          });
        } else if (typeof value === 'object') {
          searchInObject(value, currentPath, tabId);
        }
      }
    };
    
    Object.entries(normalizedData).forEach(([tabId, data]) => {
      if (data) searchInObject(data, '', tabId);
    });
    
    return results.slice(0, 10); // Limit to 10 results
  }, [searchQuery, normalizedData]);

  // Get current tab config
  const currentTab = sortedTabs.find(t => t.id === activeTab) ?? sortedTabs[0];
  const TabIcon = currentTab?.icon;

  // Navigate tabs using sorted order
  const goToNextTab = () => {
    const currentIndex = sortedTabs.findIndex(t => t.id === activeTab);
    const nextIndex = (currentIndex + 1) % sortedTabs.length;
    setActiveTab(sortedTabs[nextIndex]?.id ?? sortedTabs[0]!.id);
  };

  const goToPrevTab = () => {
    const currentIndex = sortedTabs.findIndex(t => t.id === activeTab);
    const prevIndex = (currentIndex - 1 + sortedTabs.length) % sortedTabs.length;
    setActiveTab(sortedTabs[prevIndex]?.id ?? sortedTabs[0]!.id);
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

  // Contract Health Score - comprehensive assessment across all dimensions
  const contractHealth = useMemo(() => {
    let score = 100;
    const factors: { label: string; impact: number; status: 'good' | 'warning' | 'critical' }[] = [];
    
    // Factor 1: Risk Level (up to -30 points)
    const riskLevel = normalizedData.risk?.riskLevel || 'medium';
    const riskScore = normalizedData.risk?.riskScore || 50;
    if (riskLevel === 'critical' || riskScore >= 80) {
      score -= 30;
      factors.push({ label: 'High risk level', impact: -30, status: 'critical' });
    } else if (riskLevel === 'high' || riskScore >= 60) {
      score -= 20;
      factors.push({ label: 'Elevated risk', impact: -20, status: 'warning' });
    } else if (riskLevel === 'medium' || riskScore >= 40) {
      score -= 10;
      factors.push({ label: 'Moderate risk', impact: -10, status: 'warning' });
    } else {
      factors.push({ label: 'Low risk profile', impact: 0, status: 'good' });
    }
    
    // Factor 2: Compliance (up to -25 points)
    const complianceScore = normalizedData.compliance?.score || normalizedData.compliance?.complianceScore || 100;
    if (complianceScore < 50) {
      score -= 25;
      factors.push({ label: 'Major compliance gaps', impact: -25, status: 'critical' });
    } else if (complianceScore < 70) {
      score -= 15;
      factors.push({ label: 'Compliance issues', impact: -15, status: 'warning' });
    } else if (complianceScore < 90) {
      score -= 5;
      factors.push({ label: 'Minor compliance concerns', impact: -5, status: 'warning' });
    } else {
      factors.push({ label: 'Strong compliance', impact: 0, status: 'good' });
    }
    
    // Factor 3: Data completeness (up to -20 points)
    const missingArtifacts: string[] = [];
    if (!normalizedData.overview) missingArtifacts.push('Overview');
    if (!normalizedData.financial?.totalValue && !normalizedData.financial?.rateCards?.length) missingArtifacts.push('Financial');
    if (!normalizedData.clauses?.clauses?.length) missingArtifacts.push('Clauses');
    if (!normalizedData.risk) missingArtifacts.push('Risk');
    if (!normalizedData.renewal) missingArtifacts.push('Renewal');
    
    if (missingArtifacts.length > 3) {
      score -= 20;
      factors.push({ label: `Missing ${missingArtifacts.length} key sections`, impact: -20, status: 'critical' });
    } else if (missingArtifacts.length > 1) {
      score -= 10;
      factors.push({ label: `Missing: ${missingArtifacts.join(', ')}`, impact: -10, status: 'warning' });
    } else if (missingArtifacts.length === 1) {
      score -= 5;
      factors.push({ label: `Missing: ${missingArtifacts[0]}`, impact: -5, status: 'warning' });
    } else {
      factors.push({ label: 'Complete data extraction', impact: 0, status: 'good' });
    }
    
    // Factor 4: Renewal risk (up to -15 points)
    if (normalizedData.renewal?.autoRenewal && !normalizedData.renewal?.renewalTerms?.optOutDeadline) {
      score -= 10;
      factors.push({ label: 'Auto-renewal without opt-out date', impact: -10, status: 'warning' });
    }
    const termEnd = normalizedData.renewal?.currentTermEnd;
    if (termEnd) {
      const daysUntilExpiry = Math.ceil((new Date(termEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 30 && daysUntilExpiry > 0) {
        score -= 15;
        factors.push({ label: `Expires in ${daysUntilExpiry} days`, impact: -15, status: 'critical' });
      } else if (daysUntilExpiry < 90 && daysUntilExpiry > 0) {
        score -= 5;
        factors.push({ label: `Expires in ${daysUntilExpiry} days`, impact: -5, status: 'warning' });
      }
    }
    
    // Factor 5: Negotiation balance (up to -10 points)
    const leverage = normalizedData.negotiationPoints?.overallLeverage;
    if (leverage === 'weak') {
      score -= 10;
      factors.push({ label: 'Weak negotiation position', impact: -10, status: 'warning' });
    } else if (leverage === 'balanced') {
      factors.push({ label: 'Balanced contract terms', impact: 0, status: 'good' });
    } else if (leverage === 'strong') {
      factors.push({ label: 'Favorable contract terms', impact: 0, status: 'good' });
    }
    
    // Ensure score stays in valid range
    score = Math.max(0, Math.min(100, score));
    
    // Determine overall status
    const status: 'excellent' | 'good' | 'fair' | 'poor' = 
      score >= 85 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';
    
    return { score, factors, status };
  }, [normalizedData]);

  // Synthesize action items from all artifacts
  const actionItems = useMemo(() => {
    const items: { id: string; category: string; priority: 'urgent' | 'high' | 'medium' | 'low'; action: string; deadline?: string; source: string }[] = [];
    
    // From renewal data
    const termEnd = normalizedData.renewal?.currentTermEnd;
    if (termEnd) {
      const daysUntilExpiry = Math.ceil((new Date(termEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry > 0 && daysUntilExpiry < 90) {
        items.push({
          id: 'renewal-expiry',
          category: 'Renewal',
          priority: daysUntilExpiry < 30 ? 'urgent' : 'high',
          action: `Contract expires in ${daysUntilExpiry} days - review renewal options`,
          deadline: termEnd,
          source: 'renewal'
        });
      }
    }
    if (normalizedData.renewal?.autoRenewal) {
      const noticeDays = normalizedData.renewal?.renewalTerms?.noticePeriodDays || 30;
      items.push({
        id: 'auto-renewal',
        category: 'Renewal',
        priority: 'medium',
        action: `Auto-renewal active - submit opt-out ${noticeDays} days before expiry if not renewing`,
        source: 'renewal'
      });
    }
    
    // From obligations
    const obligations = normalizedData.obligations?.obligations || [];
    obligations.forEach((o: any, i: number) => {
      if (o.status === 'pending' || o.status === 'overdue') {
        const isPast = o.dueDate && new Date(o.dueDate) < new Date();
        items.push({
          id: `obligation-${i}`,
          category: 'Obligation',
          priority: isPast ? 'urgent' : 'high',
          action: o.title || o.obligation || `Complete obligation: ${o.description?.substring(0, 50)}`,
          deadline: o.dueDate,
          source: 'obligations'
        });
      }
    });
    
    // From milestones
    const milestones = normalizedData.obligations?.milestones || [];
    milestones.forEach((m: any, i: number) => {
      if (m.status === 'upcoming' || m.status === 'due') {
        items.push({
          id: `milestone-${i}`,
          category: 'Milestone',
          priority: m.status === 'due' ? 'urgent' : 'medium',
          action: `Milestone: ${m.name || m.title}`,
          deadline: m.date || m.dueDate,
          source: 'obligations'
        });
      }
    });
    
    // From compliance issues
    const complianceIssues = normalizedData.compliance?.issues || [];
    complianceIssues.forEach((issue: any, i: number) => {
      if (issue.status === 'non-compliant' || issue.status === 'at-risk') {
        items.push({
          id: `compliance-${i}`,
          category: 'Compliance',
          priority: issue.status === 'non-compliant' ? 'high' : 'medium',
          action: `Address ${issue.regulation} compliance: ${issue.requirement?.substring(0, 60)}`,
          source: 'compliance'
        });
      }
    });
    
    // From high risks
    const riskFactors = normalizedData.risk?.riskFactors || normalizedData.risk?.factors || [];
    riskFactors.forEach((risk: any, i: number) => {
      if (risk.severity === 'critical' || risk.severity === 'high') {
        items.push({
          id: `risk-${i}`,
          category: 'Risk Mitigation',
          priority: risk.severity === 'critical' ? 'urgent' : 'high',
          action: risk.mitigation || `Mitigate ${risk.category} risk: ${risk.description?.substring(0, 50)}`,
          source: 'risk'
        });
      }
    });
    
    // From negotiation weak clauses
    const weakClauses = normalizedData.negotiationPoints?.weakClauses || [];
    weakClauses.forEach((clause: any, i: number) => {
      if (clause.impact === 'high') {
        items.push({
          id: `negotiate-${i}`,
          category: 'Negotiation',
          priority: 'medium',
          action: `Negotiate: ${clause.clauseReference} - ${clause.suggestedRevision?.substring(0, 50) || clause.issue?.substring(0, 50)}`,
          source: 'negotiationPoints'
        });
      }
    });
    
    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [normalizedData]);

  // Calculate overall confidence and determine if human review is needed
  const confidenceInfo = useMemo(() => {
    const confidenceScores: number[] = [];
    
    // Collect confidence from all artifact types
    if (normalizedData.overview?.confidence) {
      confidenceScores.push(Number(normalizedData.overview.confidence));
    }
    if (normalizedData.clauses?.confidence) {
      confidenceScores.push(Number(normalizedData.clauses.confidence));
    }
    if (normalizedData.financial?.confidence) {
      confidenceScores.push(Number(normalizedData.financial.confidence));
    }
    if (normalizedData.risk?.confidence) {
      confidenceScores.push(Number(normalizedData.risk.confidence));
    }
    if (normalizedData.compliance?.confidence) {
      confidenceScores.push(Number(normalizedData.compliance.confidence));
    }

    const avgConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : null;
    
    // Flag for human review if confidence is below 70%
    const needsHumanReview = avgConfidence !== null && avgConfidence < 70;
    const hasLowConfidenceArtifacts = confidenceScores.some(c => c < 70);
    
    return { avgConfidence, needsHumanReview, hasLowConfidenceArtifacts };
  }, [normalizedData]);

  // Handlers for editable mode
  const handleSaveArtifact = async (data: Record<string, any>) => {
    // API call to save
    try {
      await fetch(`/api/contracts/${contractId}/artifacts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
    } catch {
      // Save failed
    }
  };

  const handleAIEnhance = async (fieldId: string, currentValue: any): Promise<string> => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/artifacts/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId, currentValue })
      });
      
      if (!response.ok) {
        throw new Error('Enhancement failed');
      }
      
      const data = await response.json();
      return data.enhancedValue || currentValue;
    } catch {
      return currentValue;
    }
  };

  const handleRegenerate = async () => {
    // API call to regenerate
    try {
      await fetch(`/api/contracts/${contractId}/artifacts/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      // Regeneration failed
    }
  };

  // Toggle clause bookmark
  const toggleBookmark = useCallback((clauseId: string) => {
    setBookmarkedClauses(prev => {
      const next = new Set(prev);
      if (next.has(clauseId)) {
        next.delete(clauseId);
      } else {
        next.add(clauseId);
      }
      return next;
    });
  }, []);

  // Extract all dates for timeline view
  const allDates = useMemo(() => {
    const dates: { date: string; label: string; type: string; source: string }[] = [];
    
    // Overview dates
    if (normalizedData.overview) {
      const o = normalizedData.overview;
      if (o.effectiveDate || o.startDate) {
        dates.push({ date: o.effectiveDate || o.startDate, label: 'Effective Date', type: 'start', source: 'overview' });
      }
      if (o.expirationDate || o.endDate || o.expiryDate) {
        dates.push({ date: o.expirationDate || o.endDate || o.expiryDate, label: 'Expiration Date', type: 'end', source: 'overview' });
      }
      if (o.signedDate || o.contractDate) {
        dates.push({ date: o.signedDate || o.contractDate, label: 'Signed Date', type: 'milestone', source: 'overview' });
      }
    }
    
    // Renewal dates
    if (normalizedData.renewal) {
      const r = normalizedData.renewal;
      if (r.currentTermEnd) {
        dates.push({ date: r.currentTermEnd, label: 'Term End', type: 'end', source: 'renewal' });
      }
      (r.optOutDeadlines || []).forEach((d: any) => {
        dates.push({ date: d.date || d, label: 'Opt-out Deadline', type: 'deadline', source: 'renewal' });
      });
    }
    
    // Obligation dates
    if (normalizedData.obligations?.obligations) {
      normalizedData.obligations.obligations.forEach((o: any) => {
        if (o.dueDate) {
          dates.push({ date: o.dueDate, label: o.title || 'Obligation Due', type: 'deadline', source: 'obligations' });
        }
      });
    }
    
    // Milestone dates
    if (normalizedData.obligations?.milestones) {
      normalizedData.obligations.milestones.forEach((m: any) => {
        if (m.date || m.dueDate) {
          dates.push({ date: m.date || m.dueDate, label: m.name || 'Milestone', type: 'milestone', source: 'obligations' });
        }
      });
    }
    
    // Sort by date
    return dates
      .filter(d => d.date && !isNaN(new Date(d.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [normalizedData]);

  // Generate executive summary
  const executiveSummary = useMemo(() => {
    const summary: string[] = [];
    
    // Contract type and parties
    if (normalizedData.overview) {
      const o = normalizedData.overview;
      const parties = (o.parties || []).map((p: any) => typeof p === 'string' ? p : p.name).join(' and ');
      if (parties) {
        summary.push(`This ${detectedContractType.replace(/_/g, ' ')} agreement is between ${parties}.`);
      }
      if (o.effectiveDate) {
        summary.push(`Effective from ${new Date(o.effectiveDate).toLocaleDateString()}.`);
      }
    }
    
    // Financial highlights
    if (normalizedData.financial?.totalValue) {
      summary.push(`Total contract value: $${normalizedData.financial.totalValue.toLocaleString()}.`);
    }
    
    // Risk summary
    if (stats.riskScore !== null) {
      const riskLevel = stats.riskScore < 30 ? 'low' : stats.riskScore < 60 ? 'moderate' : 'high';
      summary.push(`Risk assessment: ${riskLevel} (${stats.riskScore}/100).`);
    }
    
    // Compliance summary
    if (stats.complianceScore !== null) {
      summary.push(`Compliance score: ${stats.complianceScore}%.`);
    }
    
    // Key clauses count
    if (stats.clauseCount > 0) {
      summary.push(`${stats.clauseCount} key clauses identified.`);
    }
    
    // High priority issues
    const highPriorityIssues = smartSuggestions.filter(s => s.priority === 'high').length;
    if (highPriorityIssues > 0) {
      summary.push(`⚠️ ${highPriorityIssues} high-priority issue${highPriorityIssues > 1 ? 's' : ''} require attention.`);
    }
    
    return summary;
  }, [normalizedData, detectedContractType, stats, smartSuggestions]);

  // Export to JSON
  const handleExportJSON = useCallback(() => {
    const exportData = {
      contractId,
      contractType: detectedContractType,
      exportedAt: new Date().toISOString(),
      artifacts: normalizedData,
      summary: {
        riskScore: stats.riskScore,
        complianceScore: stats.complianceScore,
        totalValue: stats.totalValue,
        clauseCount: stats.clauseCount
      },
      bookmarkedClauses: Array.from(bookmarkedClauses)
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${contractId}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [contractId, detectedContractType, normalizedData, stats, bookmarkedClauses]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevTab();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextTab();
          break;
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setIsFullscreen(prev => !prev);
          }
          break;
        case 'e':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setViewMode(prev => prev === 'view' ? 'edit' : 'view');
          }
          break;
        case 't':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setShowTimeline(prev => !prev);
          }
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setShowSummary(prev => !prev);
          }
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(prev => !prev);
          break;
        case 'Escape':
          setIsFullscreen(false);
          setShowKeyboardHelp(false);
          setShowTimeline(false);
          setShowSummary(false);
          break;
        // Number keys for quick tab access (1-9)
        default:
          const num = parseInt(e.key);
          if (num >= 1 && num <= 9) {
            const tabIndex = num - 1;
            if (sortedTabs[tabIndex]) {
              e.preventDefault();
              setActiveTab(sortedTabs[tabIndex].id);
            }
          }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextTab, goToPrevTab, sortedTabs]);

  // Render tab content
  const renderTabContent = () => {
    const data = normalizedData[activeTab as keyof typeof normalizedData];
    const artifactConfidence = data?.confidence || extractionMeta[activeTab]?.confidence;
    
    // Check if this artifact is not applicable for the contract type
    if (isTabNotApplicable(activeTab)) {
      const contractTypeName = detectedContractType.replace(/_/g, ' ').toLowerCase();
      const contractTypeDisplay = contractTypeName.charAt(0).toUpperCase() + contractTypeName.slice(1);
      const tabInfo = TABS.find(t => t.id === activeTab);
      const TabIconComponent = tabInfo?.icon ?? TabIcon ?? FileText;
      
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
            <TabIconComponent className="h-6 w-6 text-amber-400" />
          </div>
          <h3 className="text-base font-medium text-slate-700">Not Applicable</h3>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
            {tabInfo?.label} isn&apos;t typically relevant for <span className="font-medium text-amber-600">{contractTypeDisplay}</span> contracts.
          </p>
        </div>
      );
    }
    
    if (!data) {
      const tabInfo = TABS.find(t => t.id === activeTab);
      const TabIconComponent = tabInfo?.icon ?? TabIcon ?? FileText;

      // Show animated skeleton while artifacts are still being generated
      if (isProcessing) {
        return (
          <div className="space-y-4 animate-pulse">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-violet-100" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 bg-gradient-to-r from-slate-100 to-violet-50 rounded-xl border border-slate-100" />
              <div className="h-16 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl border border-slate-100" />
              <div className="h-20 bg-gradient-to-r from-slate-50 to-violet-50 rounded-xl border border-slate-100" />
            </div>
            <div className="flex items-center justify-center gap-2 pt-4 text-sm text-violet-500">
              <Sparkles className="h-4 w-4 animate-spin" />
              <span>AI is extracting {tabInfo?.label || 'data'}...</span>
            </div>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
            <TabIconComponent className="h-6 w-6 text-slate-300" />
          </div>
          <h3 className="text-base font-medium text-slate-700">No {tabInfo?.label || 'Data'} Found</h3>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xs">
            The AI couldn&apos;t extract this information from the contract.
          </p>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('openAIChatbot', { 
              detail: { 
                autoMessage: `Please analyze the ${tabInfo?.label || activeTab} section of this contract and extract relevant information.`,
                section: activeTab,
                contractId: contractId
              } 
            }))}
            className="mt-4 text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI to analyze this section
          </button>
        </div>
      );
    }

    // Artifact confidence header - simplified inline badge
    const ConfidenceHeader = artifactConfidence ? (
      <div className="flex items-center gap-2 mb-4">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
          artifactConfidence >= 80 ? "bg-violet-50 text-violet-700" :
          artifactConfidence >= 60 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
        )}>
          <Sparkles className="h-3 w-3" />
          {Math.round(artifactConfidence * 100)}% confidence
        </span>
      </div>
    ) : null;

    switch (activeTab) {
      case 'overview':
        return (
          <>
            {ConfidenceHeader}
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
          </>
        );
      
      case 'clauses':
        const clauses = data.clauses || data.keyClauses || [];
        
        // Get expected clause categories for this contract type
        const EXPECTED_CLAUSES_BY_TYPE: Record<ContractType, string[]> = {
          NDA: ['Confidentiality Definition', 'Confidentiality Obligations', 'Exclusions', 'Permitted Disclosure', 'Return of Materials', 'Term', 'Governing Law'],
          MSA: ['Scope of Services', 'Payment Terms', 'Term & Termination', 'Liability Limitation', 'Indemnification', 'IP Rights', 'Confidentiality', 'Warranty', 'Force Majeure'],
          SOW: ['Scope of Work', 'Deliverables', 'Timeline', 'Acceptance Criteria', 'Payment Milestones', 'Change Management'],
          SLA: ['Service Levels', 'Uptime Commitment', 'Response Times', 'Credits & Remedies', 'Exclusions', 'Measurement', 'Reporting'],
          EMPLOYMENT: ['Position & Duties', 'Compensation', 'Benefits', 'Termination', 'Non-Compete', 'Non-Solicitation', 'IP Assignment', 'Confidentiality'],
          LEASE: ['Premises', 'Rent', 'Security Deposit', 'Term', 'Maintenance', 'Use Restrictions', 'Insurance', 'Renewal', 'Termination'],
          LICENSE: ['Grant of License', 'Scope', 'Restrictions', 'Fees', 'Term', 'Termination', 'IP Ownership', 'Warranty Disclaimer'],
          PURCHASE: ['Description', 'Price', 'Payment Terms', 'Delivery', 'Inspection', 'Warranty', 'Returns', 'Limitation of Liability'],
          PARTNERSHIP: ['Contributions', 'Profit Sharing', 'Management', 'Decision Making', 'Withdrawal', 'Dissolution', 'Non-Compete'],
          CONSULTING: ['Scope of Services', 'Fees', 'Expenses', 'Term', 'Termination', 'IP Assignment', 'Confidentiality', 'Non-Compete'],
          SUBSCRIPTION: ['Service Description', 'Fees', 'Term', 'Auto-Renewal', 'Cancellation', 'Price Changes', 'Data Rights'],
          LOAN: ['Principal', 'Interest Rate', 'Payment Schedule', 'Prepayment', 'Default', 'Collateral', 'Covenants', 'Remedies'],
          SETTLEMENT: ['Release', 'Consideration', 'Non-Admission', 'Confidentiality', 'Non-Disparagement', 'Cooperation'],
          OTHER: ['Parties', 'Term', 'Termination', 'Governing Law']
        };
        
        const expectedClauses = EXPECTED_CLAUSES_BY_TYPE[detectedContractType] || EXPECTED_CLAUSES_BY_TYPE.OTHER;
        const foundClauseTitles = clauses.map((c: any) => (c.title || c.name || '').toLowerCase());
        const missingClauses = expectedClauses.filter(expected => 
          !foundClauseTitles.some((found: string) => 
            found.includes(expected.toLowerCase()) || expected.toLowerCase().includes(found)
          )
        );
        
        return (
          <>
            {ConfidenceHeader}
            {/* Missing Clauses Warning */}
            {missingClauses.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      {missingClauses.length} expected clause{missingClauses.length > 1 ? 's' : ''} not found
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Typical {detectedContractType.replace(/_/g, ' ')} contracts include: {missingClauses.slice(0, 4).join(', ')}
                      {missingClauses.length > 4 && ` and ${missingClauses.length - 4} more`}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <ClausesArtifact 
            data={{
              clauses: clauses.map((c: any, i: number) => ({
                id: c.id || `clause-${i}`,
                title: c.title || c.name || `Clause ${i + 1}`,
                content: c.content || c.text || c.description || '',
                type: c.type || c.category || 'General',
                importance: c.importance || c.priority || 'medium',
                obligations: c.obligations || [],
                risks: c.risks || c.riskFactors || [],
                isBookmarked: bookmarkedClauses.has(c.id || `clause-${i}`),
                onBookmark: () => toggleBookmark(c.id || `clause-${i}`)
              })),
              totalCount: clauses.length
            }}
          />
          </>
        );
      
      case 'financial':
        // Financial context by contract type
        const FINANCIAL_CONTEXT_BY_TYPE: Record<string, { keyFields: string[], benchmarks: string[], watchFor: string[] }> = {
          'STAFFING': { 
            keyFields: ['Hourly/Daily Rates', 'Bill Rates', 'Markup Percentages', 'Overtime Rates', 'Holiday Rates'],
            benchmarks: ['Industry markup typically 35-65%', 'Conversion fees usually 15-25% of salary'],
            watchFor: ['Rate escalation clauses', 'Minimum billing guarantees']
          },
          'PROFESSIONAL_SERVICES': { 
            keyFields: ['Hourly Rates', 'Fixed Fees', 'Milestone Payments', 'Expense Caps'],
            benchmarks: ['Consulting rates vary $150-500/hr by seniority', 'Fixed-fee projects often 10-20% higher'],
            watchFor: ['Scope creep pricing', 'Change order rates']
          },
          'SOFTWARE_LICENSE': { 
            keyFields: ['License Fees', 'Per-Seat Costs', 'Annual Maintenance', 'Support Tiers'],
            benchmarks: ['Maintenance typically 18-22% of license', 'Volume discounts often 10-30%'],
            watchFor: ['Auto-renewal price increases', 'True-up provisions']
          },
          'SAAS': { 
            keyFields: ['Monthly/Annual Subscription', 'Per-User Pricing', 'Usage Tiers', 'Add-on Costs'],
            benchmarks: ['Annual payment discounts typically 15-20%', 'Enterprise tiers negotiable'],
            watchFor: ['Overage charges', 'Feature tier limitations']
          },
          'MASTER_SERVICE': { 
            keyFields: ['Rate Cards', 'SOW Pricing Models', 'Volume Discounts', 'Caps'],
            benchmarks: ['MSA rates typically 5-15% below spot rates', 'Volume commitments unlock deeper discounts'],
            watchFor: ['Minimum spend requirements', 'Rate lock periods']
          },
          'EMPLOYMENT': { 
            keyFields: ['Base Salary', 'Bonus Structure', 'Equity/Stock', 'Benefits Value'],
            benchmarks: ['Total comp typically 1.25-1.4x base salary', 'Signing bonuses often 10-20% of base'],
            watchFor: ['Clawback provisions', 'Vesting schedules']
          },
          'NDA': { 
            keyFields: ['Breach Penalties', 'Damages Caps'],
            benchmarks: ['Liquidated damages vary widely by industry'],
            watchFor: ['Unlimited liability clauses']
          },
          'LEASE': { 
            keyFields: ['Monthly Rent', 'Security Deposit', 'CAM Charges', 'Escalation Rates'],
            benchmarks: ['Commercial escalation typically 2-4% annually', 'Deposits usually 2-3 months rent'],
            watchFor: ['Hidden fees', 'Restoration costs']
          },
          'PURCHASE_AGREEMENT': { 
            keyFields: ['Purchase Price', 'Payment Terms', 'Warranties', 'Delivery Costs'],
            benchmarks: ['Net 30-60 typical for B2B', 'Early payment discounts 1-2%'],
            watchFor: ['Price adjustment clauses', 'Restocking fees']
          },
          'PARTNERSHIP': { 
            keyFields: ['Profit Sharing', 'Capital Contributions', 'Distribution Schedule'],
            benchmarks: ['Profit splits based on capital/effort contribution'],
            watchFor: ['Dilution provisions', 'Buyout valuations']
          },
          'CONSULTING': { 
            keyFields: ['Day Rates', 'Retainer Fees', 'Success Fees', 'Expense Policy'],
            benchmarks: ['Senior consultant rates $1500-3000/day', 'Retainers often 80% of expected hours'],
            watchFor: ['Exclusivity premiums', 'Kill fee terms']
          },
          'CONSTRUCTION': { 
            keyFields: ['Contract Price', 'Progress Payments', 'Retainage', 'Change Order Rates'],
            benchmarks: ['Retainage typically 5-10%', 'Bonds usually 1-3% of contract'],
            watchFor: ['Material escalation clauses', 'Delay penalties']
          },
          'LICENSING': { 
            keyFields: ['Royalty Rates', 'Minimum Guarantees', 'Territory Fees', 'Sublicense Splits'],
            benchmarks: ['IP royalties typically 2-15% depending on industry'],
            watchFor: ['Audit rights', 'Reporting requirements']
          },
          'OTHER': { 
            keyFields: ['Total Value', 'Payment Schedule', 'Penalties', 'Discounts'],
            benchmarks: ['Review against industry standards'],
            watchFor: ['Hidden costs', 'Automatic renewals']
          }
        };
        const defaultFinancial = { keyFields: [] as string[], benchmarks: [] as string[], watchFor: [] as string[] };
        const financialContext = FINANCIAL_CONTEXT_BY_TYPE[detectedContractType] ?? FINANCIAL_CONTEXT_BY_TYPE['OTHER'] ?? defaultFinancial;
        
        // Normalize penalties array to proper format
        const normalizedPenalties = (data.penalties || []).map((p: any, i: number) => 
          typeof p === 'string' 
            ? { type: 'penalty', amount: 0, description: p }
            : { type: p.type || 'penalty', amount: p.amount || 0, description: p.description || '', trigger: p.trigger }
        );
        
        // Normalize discounts array to proper format
        const normalizedDiscounts = (data.discounts || []).map((d: any, i: number) =>
          typeof d === 'string'
            ? { type: 'discount', value: 0, unit: 'percentage' as const, description: d }
            : { type: d.type || 'discount', value: d.value || 0, unit: d.unit || 'percentage', description: d.description }
        );
        
        return (
          <>
            {ConfidenceHeader}
            {/* Financial Context by Contract Type */}
            <div className="mb-4 p-3 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg border border-violet-500/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-400">
                  Financial Focus for {detectedContractType.replace(/_/g, ' ')} Contracts
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
                <div>
                  <span className="text-violet-400 font-medium">Key Fields:</span>
                  <ul className="mt-1 space-y-0.5">
                    {financialContext.keyFields.map((field, i) => (
                      <li key={i}>• {field}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-violet-400 font-medium">Industry Benchmarks:</span>
                  <ul className="mt-1 space-y-0.5">
                    {financialContext.benchmarks.map((b, i) => (
                      <li key={i}>• {b}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-amber-400 font-medium">Watch For:</span>
                  <ul className="mt-1 space-y-0.5">
                    {financialContext.watchFor.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <FinancialArtifact 
              data={{
                totalValue: data.totalValue,
                currency: data.currency || 'USD',
                paymentTerms: data.paymentTerms,
                paymentSchedule: data.paymentSchedule,
                yearlyBreakdown: data.yearlyBreakdown,
                costBreakdown: data.costBreakdown,
                rates: data.rateCards || data.rates || normalizedData.rates?.rateCards || [],
                financialTables: data.financialTables || [],
                offers: data.offers || [],
                discounts: normalizedDiscounts,
                penalties: normalizedPenalties,
                paymentMethod: data.paymentMethod,
                invoicingRequirements: data.invoicingRequirements,
                summary: data.summary || data.analysis,
                analysis: data.analysis
              }}
            />
          </>
        );
      
      case 'risk':
        const riskFactors = data.riskFactors || data.factors || data.risks || [];
        // Normalize risk level - handle various formats from AI
        const rawRiskLevel = data.riskLevel || data.overallRisk || data.risk_level || 'medium';
        const normalizedRiskLevel = (typeof rawRiskLevel === 'string' ? rawRiskLevel : 'medium').toLowerCase();
        const riskScore = data.riskScore || data.overallScore || data.score || 
          (normalizedRiskLevel === 'critical' ? 90 : normalizedRiskLevel === 'high' ? 70 : normalizedRiskLevel === 'medium' ? 50 : 25);
        
        // Contract-type-specific risk context
        const RISK_CONTEXT_BY_TYPE: Record<ContractType, { commonRisks: string[]; watchFor: string }> = {
          NDA: { commonRisks: ['IP exposure', 'Broad definition', 'Unlimited term'], watchFor: 'overly broad confidentiality definitions and one-sided obligations' },
          MSA: { commonRisks: ['Unlimited liability', 'IP ownership', 'Auto-renewal'], watchFor: 'liability caps, indemnification scope, and termination rights' },
          SOW: { commonRisks: ['Scope creep', 'Milestone ambiguity', 'Acceptance gaps'], watchFor: 'unclear deliverables and change management process' },
          SLA: { commonRisks: ['Unrealistic targets', 'Vague penalties', 'Exclusion abuse'], watchFor: 'uptime definitions and credit calculation methodology' },
          EMPLOYMENT: { commonRisks: ['Broad non-compete', 'IP overreach', 'Termination gaps'], watchFor: 'geographic scope of non-compete and IP assignment breadth' },
          LEASE: { commonRisks: ['Hidden fees', 'Maintenance ambiguity', 'Sublease lock'], watchFor: 'CAM charges, escalation clauses, and restoration requirements' },
          LICENSE: { commonRisks: ['Usage restrictions', 'Audit overreach', 'Data access'], watchFor: 'license scope, audit rights, and data portability on termination' },
          PURCHASE: { commonRisks: ['Delivery terms', 'Warranty limits', 'Return policy'], watchFor: 'acceptance criteria and limitation of liability' },
          PARTNERSHIP: { commonRisks: ['Profit sharing', 'Decision deadlock', 'Exit barriers'], watchFor: 'governance structure and buyout mechanisms' },
          CONSULTING: { commonRisks: ['Scope boundaries', 'Rate ambiguity', 'IP ownership'], watchFor: 'change orders and expense policies' },
          SUBSCRIPTION: { commonRisks: ['Auto-renewal traps', 'Price increases', 'Downgrade lock'], watchFor: 'renewal notice periods and price protection clauses' },
          LOAN: { commonRisks: ['Hidden fees', 'Prepayment penalties', 'Covenant breach'], watchFor: 'default definitions and acceleration clauses' },
          SETTLEMENT: { commonRisks: ['Release scope', 'Non-disparagement', 'Confidentiality'], watchFor: 'breadth of release and carve-outs for future claims' },
          OTHER: { commonRisks: ['Unclear terms', 'Missing protections'], watchFor: 'core obligations and termination rights' }
        };
        
        const riskContext = RISK_CONTEXT_BY_TYPE[detectedContractType] || RISK_CONTEXT_BY_TYPE.OTHER;
        
        return (
          <>
            {ConfidenceHeader}
            {/* Contract-type risk context */}
            <div className="mb-4 p-3 rounded-lg bg-violet-50 border border-violet-200">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-violet-800">
                    {detectedContractType.replace(/_/g, ' ')} Risk Context
                  </p>
                  <p className="text-xs text-violet-700 mt-1">
                    Common risks: {riskContext.commonRisks.join(', ')}
                  </p>
                  <p className="text-xs text-violet-600 mt-1">
                    <span className="font-medium">Watch for:</span> {riskContext.watchFor}
                  </p>
                </div>
              </div>
            </div>
            <RiskArtifact 
              data={{
                overallScore: riskScore,
                riskLevel: normalizedRiskLevel as 'critical' | 'high' | 'medium' | 'low',
                factors: riskFactors.map((f: any, i: number) => ({
                  id: f.id || `risk-${i}`,
                  category: f.category || f.type || 'General',
                  description: f.description || f.details || '',
                  severity: (f.severity || f.level || 'medium').toLowerCase(),
                  mitigation: f.mitigation || f.recommendation
                })),
                summary: data.summary || data.assessment
              }}
            />
          </>
        );
      
      case 'compliance':
        // Compliance context by contract type
        const COMPLIANCE_CONTEXT_BY_TYPE: Record<string, { keyRegulations: string[], commonIssues: string[], complianceTips: string }> = {
          'STAFFING': { 
            keyRegulations: ['Labor laws', 'Worker classification (W-2 vs 1099)', 'Background check regulations', 'E-Verify', 'EEO compliance'],
            commonIssues: ['Misclassification risk', 'Immigration compliance', 'Wage and hour violations'],
            complianceTips: 'Ensure proper worker classification and maintain I-9 documentation'
          },
          'PROFESSIONAL_SERVICES': { 
            keyRegulations: ['Professional licensing', 'Industry certifications', 'Insurance requirements', 'COI maintenance'],
            commonIssues: ['License expiration', 'Insurance lapses', 'Unauthorized practice'],
            complianceTips: 'Verify current licenses and request updated COIs at each renewal'
          },
          'SOFTWARE_LICENSE': { 
            keyRegulations: ['Export controls (EAR/ITAR)', 'Data protection (GDPR/CCPA)', 'Accessibility (ADA/WCAG)', 'SOX (if applicable)'],
            commonIssues: ['License over-deployment', 'Data residency violations', 'Audit non-cooperation'],
            complianceTips: 'Maintain accurate deployment records and conduct periodic license audits'
          },
          'SAAS': { 
            keyRegulations: ['GDPR', 'CCPA', 'SOC 2', 'HIPAA (if applicable)', 'ISO 27001'],
            commonIssues: ['Data processing agreements', 'Subprocessor notifications', 'Security certifications'],
            complianceTips: 'Request and review SOC 2 reports annually; maintain DPA inventory'
          },
          'MASTER_SERVICE': { 
            keyRegulations: ['Vendor management policies', 'Anti-corruption (FCPA)', 'Supply chain compliance'],
            commonIssues: ['Subcontractor compliance flow-down', 'Audit right limitations', 'Compliance certifications'],
            complianceTips: 'Ensure compliance obligations flow down to subcontractors'
          },
          'EMPLOYMENT': { 
            keyRegulations: ['Employment law', 'EEOC', 'ADA', 'FMLA', 'FLSA', 'State-specific laws'],
            commonIssues: ['Discrimination claims', 'Wage violations', 'Benefit administration'],
            complianceTips: 'Review with HR and legal; ensure handbook alignment'
          },
          'NDA': { 
            keyRegulations: ['Trade secret laws (DTSA)', 'State NDA limitations', 'Non-compete enforceability'],
            commonIssues: ['Overbroad definitions', 'Unilateral obligations', 'Indefinite terms'],
            complianceTips: 'Check state-specific enforceability; ensure mutual reasonable scope'
          },
          'LEASE': { 
            keyRegulations: ['Building codes', 'ADA accessibility', 'Environmental regulations', 'Fire safety'],
            commonIssues: ['Permitted use violations', 'Sublease restrictions', 'Modification approvals'],
            complianceTips: 'Review certificate of occupancy; understand use restrictions'
          },
          'PURCHASE_AGREEMENT': { 
            keyRegulations: ['UCC', 'Product safety (CPSC)', 'Import/export regulations', 'Warranty laws'],
            commonIssues: ['Product compliance certifications', 'Customs documentation', 'Warranty terms'],
            complianceTips: 'Request compliance certifications for regulated products'
          },
          'PARTNERSHIP': { 
            keyRegulations: ['Partnership law', 'Securities regulations', 'Tax compliance', 'Anti-money laundering'],
            commonIssues: ['Capital call compliance', 'Distribution restrictions', 'Reporting obligations'],
            complianceTips: 'Ensure proper partnership registration and tax elections'
          },
          'CONSULTING': { 
            keyRegulations: ['Professional licensing', 'Conflict of interest', 'Confidentiality'],
            commonIssues: ['Scope boundaries', 'Deliverable ownership', 'Non-compete overreach'],
            complianceTips: 'Clarify IP ownership and confidentiality scope upfront'
          },
          'CONSTRUCTION': { 
            keyRegulations: ['OSHA', 'Building permits', 'Environmental (EPA)', 'Prevailing wage laws'],
            commonIssues: ['Permit violations', 'Safety non-compliance', 'Change order documentation'],
            complianceTips: 'Verify all permits before work begins; maintain safety records'
          },
          'LICENSING': { 
            keyRegulations: ['IP law', 'Export controls', 'Antitrust', 'Domain-specific regulations'],
            commonIssues: ['Scope creep', 'Unauthorized sublicensing', 'Territorial violations'],
            complianceTips: 'Document all licensed uses; conduct periodic usage audits'
          },
          'OTHER': { 
            keyRegulations: ['Industry-specific regulations', 'General contract law', 'Consumer protection'],
            commonIssues: ['Ambiguous compliance obligations', 'Missing regulatory references'],
            complianceTips: 'Identify applicable regulations and ensure contract addresses them'
          }
        };
        const defaultCompliance = { keyRegulations: [] as string[], commonIssues: [] as string[], complianceTips: '' };
        const complianceContext = COMPLIANCE_CONTEXT_BY_TYPE[detectedContractType] ?? COMPLIANCE_CONTEXT_BY_TYPE['OTHER'] ?? defaultCompliance;
        
        const issues = data.issues || data.requirements || data.checks || [];
        return (
          <>
            {ConfidenceHeader}
            {/* Compliance Context by Contract Type */}
            <div className="mb-4 p-3 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-lg border border-violet-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-400">
                  Compliance Focus for {detectedContractType.replace(/_/g, ' ')} Contracts
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
                <div>
                  <span className="text-violet-400 font-medium">Key Regulations:</span>
                  <ul className="mt-1 space-y-0.5">
                    {complianceContext.keyRegulations.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-fuchsia-400 font-medium">Common Issues:</span>
                  <ul className="mt-1 space-y-0.5">
                    {complianceContext.commonIssues.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-pink-400 font-medium">Compliance Tips:</span>
                  <p className="mt-1">{complianceContext.complianceTips}</p>
                </div>
              </div>
            </div>
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
          </>
        );
      
      case 'obligations':
        // Obligation context by contract type
        const OBLIGATION_CONTEXT_BY_TYPE: Record<string, { typicalObligations: string[], criticalDeadlines: string[], trackingTips: string }> = {
          'STAFFING': { 
            typicalObligations: ['Candidate submittal SLAs', 'Background check completion', 'Timesheet approval', 'Invoice submission'],
            criticalDeadlines: ['Worker start dates', 'Contract extensions', 'Rate card renewals'],
            trackingTips: 'Track per-position obligations and monitor fill rate SLAs'
          },
          'PROFESSIONAL_SERVICES': { 
            typicalObligations: ['Milestone deliveries', 'Status reports', 'Change request responses', 'Resource availability'],
            criticalDeadlines: ['Project milestones', 'Acceptance periods', 'Payment due dates'],
            trackingTips: 'Link obligations to project phases and monitor acceptance windows'
          },
          'SOFTWARE_LICENSE': { 
            typicalObligations: ['License usage reporting', 'Audit cooperation', 'Renewal notices', 'Update deployments'],
            criticalDeadlines: ['True-up deadlines', 'Renewal opt-out windows', 'Audit response periods'],
            trackingTips: 'Monitor license counts and set renewal reminders 90+ days ahead'
          },
          'SAAS': { 
            typicalObligations: ['Data backup compliance', 'Security certifications', 'Uptime reporting', 'Feature availability'],
            criticalDeadlines: ['Renewal dates', 'Price lock expirations', 'Data export windows'],
            trackingTips: 'Track SLA credits and review uptime reports monthly'
          },
          'MASTER_SERVICE': { 
            typicalObligations: ['Rate card updates', 'Volume commitment reports', 'SOW initiation', 'Vendor reviews'],
            criticalDeadlines: ['Annual renewals', 'Rate adjustment windows', 'Volume threshold dates'],
            trackingTips: 'Maintain SOW register and track cumulative spend against commitments'
          },
          'EMPLOYMENT': { 
            typicalObligations: ['Performance reviews', 'Benefit enrollments', 'Compliance training', 'Equipment returns'],
            criticalDeadlines: ['Probation end', 'Vesting dates', 'Non-compete expiry'],
            trackingTips: 'Calendar all vesting milestones and review periods'
          },
          'NDA': { 
            typicalObligations: ['Information handling', 'Return/destruction of materials', 'Breach notification'],
            criticalDeadlines: ['Confidentiality period end', 'Survival clause duration'],
            trackingTips: 'Document all shared confidential information for return compliance'
          },
          'LEASE': { 
            typicalObligations: ['Rent payments', 'Maintenance requests', 'Insurance renewals', 'Inspection access'],
            criticalDeadlines: ['Lease renewal notice', 'Rent escalation dates', 'Option exercise windows'],
            trackingTips: 'Set calendar reminders 60-90 days before key dates'
          },
          'PURCHASE_AGREEMENT': { 
            typicalObligations: ['Order placement', 'Delivery acceptance', 'Payment processing', 'Warranty claims'],
            criticalDeadlines: ['Delivery dates', 'Acceptance periods', 'Payment terms'],
            trackingTips: 'Track each order through delivery and acceptance'
          },
          'PARTNERSHIP': { 
            typicalObligations: ['Capital contributions', 'Profit distributions', 'Meeting attendance', 'Financial reporting'],
            criticalDeadlines: ['Distribution dates', 'Contribution calls', 'Annual reviews'],
            trackingTips: 'Maintain contribution and distribution ledger'
          },
          'CONSULTING': { 
            typicalObligations: ['Deliverable submissions', 'Time reporting', 'Expense documentation', 'Knowledge transfer'],
            criticalDeadlines: ['Retainer renewals', 'Project deadlines', 'Invoice cutoffs'],
            trackingTips: 'Track hours against retainer and document all expenses'
          },
          'CONSTRUCTION': { 
            typicalObligations: ['Progress updates', 'Permit maintenance', 'Safety compliance', 'Change order documentation'],
            criticalDeadlines: ['Substantial completion', 'Final completion', 'Punch list clearance'],
            trackingTips: 'Track percentage completion against payment schedule'
          },
          'LICENSING': { 
            typicalObligations: ['Royalty reporting', 'Quality compliance', 'Usage tracking', 'Sublicense management'],
            criticalDeadlines: ['Royalty payment dates', 'Minimum guarantee deadlines', 'Audit periods'],
            trackingTips: 'Maintain detailed usage logs for royalty calculations'
          },
          'OTHER': { 
            typicalObligations: ['Primary deliverables', 'Payment obligations', 'Reporting requirements', 'Compliance tasks'],
            criticalDeadlines: ['Key milestones', 'Payment due dates', 'Renewal windows'],
            trackingTips: 'Create comprehensive obligation register with owners and due dates'
          }
        };
        const defaultObligation = { typicalObligations: [] as string[], criticalDeadlines: [] as string[], trackingTips: '' };
        const obligationContext = OBLIGATION_CONTEXT_BY_TYPE[detectedContractType] ?? OBLIGATION_CONTEXT_BY_TYPE['OTHER'] ?? defaultObligation;
        
        // Map obligations from worker output to UI expected format
        const mappedObligations = (data.obligations || []).map((o: any, i: number) => ({
          id: o.id || `obligation-${i}`,
          title: o.obligation || o.title || o.description || 'Obligation',
          party: o.party || 'Unknown',
          type: (['deliverable', 'sla', 'milestone', 'reporting', 'compliance'].includes(o.type?.toLowerCase()) 
            ? o.type.toLowerCase() 
            : 'other') as 'deliverable' | 'sla' | 'milestone' | 'reporting' | 'compliance' | 'other',
          description: o.description || o.obligation || '',
          dueDate: o.dueDate,
          recurring: o.frequency && o.frequency !== 'one-time' ? {
            frequency: o.frequency,
            interval: 1
          } : undefined,
          status: (['pending', 'in-progress', 'completed', 'overdue'].includes(o.status?.toLowerCase())
            ? o.status.toLowerCase()
            : 'pending') as 'pending' | 'in-progress' | 'completed' | 'overdue'
        }));
        
        const mappedMilestones = (data.milestones || []).map((m: any, i: number) => ({
          id: m.id || `milestone-${i}`,
          name: m.name || m.title || `Milestone ${i + 1}`,
          date: m.dueDate || m.date || '',
          deliverables: [m.description].filter(Boolean),
          status: (['upcoming', 'due', 'completed', 'missed'].includes(m.status?.toLowerCase())
            ? m.status.toLowerCase()
            : 'upcoming') as 'upcoming' | 'due' | 'completed' | 'missed'
        }));
        
        return (
          <>
            {ConfidenceHeader}
            {/* Obligation Context by Contract Type */}
            <div className="mb-4 p-3 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg border border-violet-500/20">
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-400">
                  Obligation Tracking for {detectedContractType.replace(/_/g, ' ')} Contracts
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
                <div>
                  <span className="text-violet-400 font-medium">Typical Obligations:</span>
                  <ul className="mt-1 space-y-0.5">
                    {obligationContext.typicalObligations.map((o, i) => (
                      <li key={i}>• {o}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-indigo-400 font-medium">Critical Deadlines:</span>
                  <ul className="mt-1 space-y-0.5">
                    {obligationContext.criticalDeadlines.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-violet-400 font-medium">Tracking Tips:</span>
                  <p className="mt-1">{obligationContext.trackingTips}</p>
                </div>
              </div>
            </div>
            <ObligationsArtifact 
              data={{
                obligations: mappedObligations,
                milestones: mappedMilestones,
                slaMetrics: data.slaMetrics,
                summary: data.summary
              }}
            />
          </>
        );
      
      case 'renewal':
        // Renewal context by contract type
        const RENEWAL_CONTEXT_BY_TYPE: Record<string, { typicalTerms: string[], watchDates: string[], renewalTips: string }> = {
          'STAFFING': { 
            typicalTerms: ['12-month terms', '30-60 day renewal notice', 'Rate card refresh on renewal'],
            watchDates: ['Rate card expiry', 'Contract anniversary', 'Volume commitment reset'],
            renewalTips: 'Review fill rates and renegotiate rates based on performance; consider multi-year for rate locks'
          },
          'PROFESSIONAL_SERVICES': { 
            typicalTerms: ['Project-based or annual', '30-90 day notice', 'Scope refresh on renewal'],
            watchDates: ['Project end dates', 'Annual reviews', 'SOW expirations'],
            renewalTips: 'Bundle future projects for better rates; review and update rate cards annually'
          },
          'SOFTWARE_LICENSE': { 
            typicalTerms: ['Annual or 3-year terms', '30-90 day auto-renewal notice', 'Maintenance renewal separate'],
            watchDates: ['License expiry', 'Maintenance renewal', 'True-up dates', 'Price increase effective'],
            renewalTips: 'Negotiate renewal pricing at initial signing; request multi-year price caps'
          },
          'SAAS': { 
            typicalTerms: ['Monthly or annual', 'Auto-renewal standard', '30 day cancellation'],
            watchDates: ['Subscription renewal', 'Price increase notices', 'Tier upgrade deadlines'],
            renewalTips: 'Switch to annual for discounts; negotiate price caps for renewals'
          },
          'MASTER_SERVICE': { 
            typicalTerms: ['2-3 year initial, 1-year renewals', '60-90 day notice', 'Rate card annual refresh'],
            watchDates: ['MSA expiry', 'Rate card updates', 'Volume threshold dates'],
            renewalTips: 'Start renewal discussions 6 months early; aggregate new requirements for leverage'
          },
          'EMPLOYMENT': { 
            typicalTerms: ['At-will or fixed term', 'Performance review cycles', 'Benefit enrollment periods'],
            watchDates: ['Contract end', 'Probation end', 'Equity vesting milestones'],
            renewalTips: 'Time compensation discussions with review cycles; document accomplishments'
          },
          'NDA': { 
            typicalTerms: ['2-5 year terms', 'Often auto-renewing', 'Survival clauses extend beyond'],
            watchDates: ['NDA expiry', 'Confidentiality period end', 'Return obligation trigger'],
            renewalTips: 'Track which information is covered; consider shorter terms for limited engagements'
          },
          'LEASE': { 
            typicalTerms: ['3-10 year terms', '6-12 month renewal notice', 'Escalation clauses on renewal'],
            watchDates: ['Lease expiry', 'Renewal option deadline', 'Rent escalation dates'],
            renewalTips: 'Notify early to preserve options; research market rates before negotiating'
          },
          'PURCHASE_AGREEMENT': { 
            typicalTerms: ['Order-by-order or blanket POs', 'Annual review common', 'Price adjustments on renewal'],
            watchDates: ['Agreement expiry', 'Price protection expiry', 'Volume commitment periods'],
            renewalTips: 'Consolidate volume for better pricing; request extended price protection'
          },
          'PARTNERSHIP': { 
            typicalTerms: ['Indefinite or fixed term', 'Annual review periods', 'Exit provisions trigger'],
            watchDates: ['Partnership anniversary', 'Capital call dates', 'Distribution schedules'],
            renewalTips: 'Conduct annual partnership reviews; update contribution expectations'
          },
          'CONSULTING': { 
            typicalTerms: ['Project or retainer-based', '30 day termination typical', 'Monthly retainer renewals'],
            watchDates: ['Retainer renewal', 'Project milestones', 'Rate adjustment dates'],
            renewalTips: 'Lock in retainer rates for consistency; review scope alignment regularly'
          },
          'CONSTRUCTION': { 
            typicalTerms: ['Project-based', 'Warranty periods extend', 'Change orders modify terms'],
            watchDates: ['Substantial completion', 'Final completion', 'Warranty expiry'],
            renewalTips: 'Track warranty periods carefully; document punch list completion'
          },
          'LICENSING': { 
            typicalTerms: ['1-5 year terms', 'Renewal options negotiated', 'Minimum guarantees reset'],
            watchDates: ['License expiry', 'Minimum guarantee deadlines', 'Royalty report dates'],
            renewalTips: 'Review sales performance before renewal; renegotiate minimums based on actual usage'
          },
          'OTHER': { 
            typicalTerms: ['Varies by contract type', 'Check specific renewal clauses'],
            watchDates: ['Contract expiry', 'Notice deadlines', 'Key milestones'],
            renewalTips: 'Set calendar reminders 90 days before any key date; review terms thoroughly'
          }
        };
        const defaultRenewal = { typicalTerms: [] as string[], watchDates: [] as string[], renewalTips: '' };
        const renewalContext = RENEWAL_CONTEXT_BY_TYPE[detectedContractType] ?? RENEWAL_CONTEXT_BY_TYPE['OTHER'] ?? defaultRenewal;
        
        // Map renewal data from worker output to UI expected format
        const renewalTermsObj = data.renewalTerms ? {
          renewalPeriod: typeof data.renewalTerms === 'string' ? data.renewalTerms : (data.renewalTerms.renewalPeriod || data.renewalPeriod || '12 months'),
          noticePeriodDays: data.noticeRequirements?.noticePeriod 
            ? parseInt(String(data.noticeRequirements.noticePeriod).replace(/\D/g, '')) || 30 
            : 30,
          optOutDeadline: data.renewalTerms?.optOutDeadline
        } : data.renewalPeriod ? {
          renewalPeriod: data.renewalPeriod,
          noticePeriodDays: 30,
          optOutDeadline: undefined
        } : undefined;

        const terminationNoticeObj = data.terminationRights || data.terminationNotice ? {
          requiredDays: parseInt(String(data.terminationRights?.noticePeriod || data.terminationNotice?.requiredDays || 30).replace(/\D/g, '')) || 30,
          format: data.noticeRequirements?.noticeMethod,
          recipientParty: data.noticeRequirements?.noticeRecipient
        } : undefined;

        return (
          <>
            {ConfidenceHeader}
            {/* Renewal Context by Contract Type */}
            <div className="mb-4 p-3 bg-gradient-to-r from-violet-500/10 to-violet-500/10 rounded-lg border border-violet-500/20">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-400">
                  Renewal Management for {detectedContractType.replace(/_/g, ' ')} Contracts
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
                <div>
                  <span className="text-violet-400 font-medium">Typical Terms:</span>
                  <ul className="mt-1 space-y-0.5">
                    {renewalContext.typicalTerms.map((t, i) => (
                      <li key={i}>• {t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-violet-400 font-medium">Watch These Dates:</span>
                  <ul className="mt-1 space-y-0.5">
                    {renewalContext.watchDates.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-violet-400 font-medium">Renewal Tips:</span>
                  <p className="mt-1">{renewalContext.renewalTips}</p>
                </div>
              </div>
            </div>
            <RenewalArtifact 
              data={{
                autoRenewal: data.autoRenewal ?? false,
                currentTermEnd: data.currentTermEnd || data.expirationDate,
                renewalTerms: renewalTermsObj,
              terminationNotice: terminationNoticeObj,
              priceEscalation: data.priceEscalation,
              optOutDeadlines: data.optOutDeadlines,
              renewalAlerts: data.renewalAlerts,
              renewalCount: data.renewalCount,
              summary: data.summary || (data.recommendations ? `Recommendations: ${data.recommendations.join(', ')}` : undefined)
            }}
          />
          </>
        );
      
      case 'negotiationPoints':
        // Negotiation context by contract type
        const NEGOTIATION_CONTEXT_BY_TYPE: Record<string, { keyLeverageAreas: string[], commonConcessions: string[], negotiationTips: string }> = {
          'STAFFING': { 
            keyLeverageAreas: ['Volume commitments', 'Exclusivity arrangements', 'Long-term partnership', 'Fill rate guarantees'],
            commonConcessions: ['Rate reductions for volume', 'Conversion fee waivers', 'Extended payment terms'],
            negotiationTips: 'Lead with volume to unlock rate concessions; negotiate per-role rate caps'
          },
          'PROFESSIONAL_SERVICES': { 
            keyLeverageAreas: ['Multi-project pipeline', 'Referral potential', 'Case study rights', 'Timeline flexibility'],
            commonConcessions: ['Blended rates', 'Fixed-fee options', 'Free discovery phase'],
            negotiationTips: 'Request fixed-fee options for well-defined scope; negotiate change order rates upfront'
          },
          'SOFTWARE_LICENSE': { 
            keyLeverageAreas: ['Multi-year commitment', 'Enterprise deployment', 'Reference customer status', 'Beta participation'],
            commonConcessions: ['Volume discounts', 'Maintenance fee reduction', 'Extended support', 'Free training'],
            negotiationTips: 'Negotiate before quarter-end; request price protection for multi-year deals'
          },
          'SAAS': { 
            keyLeverageAreas: ['User growth potential', 'Annual prepayment', 'Case study participation', 'Feature feedback'],
            commonConcessions: ['Monthly to annual discount', 'Feature upgrades', 'Support tier bumps', 'API access'],
            negotiationTips: 'Annual payment unlocks 15-20% savings; negotiate data export guarantees'
          },
          'MASTER_SERVICE': { 
            keyLeverageAreas: ['Spend consolidation', 'Preferred vendor status', 'Long-term partnership', 'Innovation collaboration'],
            commonConcessions: ['Rate cards locks', 'Volume rebates', 'Priority resource access', 'Dedicated account team'],
            negotiationTips: 'Aggregate spend across business units to maximize leverage'
          },
          'EMPLOYMENT': { 
            keyLeverageAreas: ['Competing offers', 'Unique skills', 'Start date flexibility', 'Remote work arrangements'],
            commonConcessions: ['Signing bonus', 'Accelerated vesting', 'Title adjustments', 'PTO increases'],
            negotiationTips: 'Always negotiate total compensation, not just base salary'
          },
          'NDA': { 
            keyLeverageAreas: ['Mutual obligations', 'Scope narrowing', 'Carve-outs', 'Term limits'],
            commonConcessions: ['Mutual vs one-way', 'Residual knowledge clause', 'Shorter confidentiality periods'],
            negotiationTips: 'Push for mutual NDAs; negotiate reasonable term limits (2-3 years typical)'
          },
          'LEASE': { 
            keyLeverageAreas: ['Long-term commitment', 'Financial strength', 'Expansion potential', 'Market conditions'],
            commonConcessions: ['Free rent periods', 'TI allowances', 'Renewal options', 'Expansion rights'],
            negotiationTips: 'Negotiate in tenant-favorable markets; request TI allowance for buildout'
          },
          'PURCHASE_AGREEMENT': { 
            keyLeverageAreas: ['Order volume', 'Repeat business', 'Payment terms', 'Logistics flexibility'],
            commonConcessions: ['Volume pricing', 'Extended warranties', 'Free shipping', 'Net 60 terms'],
            negotiationTips: 'Aggregate orders to maximize volume pricing; negotiate restocking fee waivers'
          },
          'PARTNERSHIP': { 
            keyLeverageAreas: ['Capital contribution', 'Strategic value', 'Industry expertise', 'Network access'],
            commonConcessions: ['Profit share adjustments', 'Management fee reductions', 'Veto rights', 'Exit options'],
            negotiationTips: 'Document all contribution types (capital, IP, sweat equity) explicitly'
          },
          'CONSULTING': { 
            keyLeverageAreas: ['Retainer commitment', 'Multi-engagement pipeline', 'Reference rights', 'IP licensing'],
            commonConcessions: ['Retainer discounts', 'Success fee reductions', 'Expense caps', 'Knowledge transfer'],
            negotiationTips: 'Negotiate retainer rates 10-20% below hourly; cap expenses as % of fees'
          },
          'CONSTRUCTION': { 
            keyLeverageAreas: ['Project size', 'Pipeline visibility', 'Payment terms', 'Schedule flexibility'],
            commonConcessions: ['Bid price reductions', 'Retainage release', 'Extended warranties', 'Penalty caps'],
            negotiationTips: 'Negotiate progress payment schedules; cap liquidated damages reasonably'
          },
          'LICENSING': { 
            keyLeverageAreas: ['Market reach', 'Distribution capabilities', 'Brand value', 'Exclusivity'],
            commonConcessions: ['Lower royalty rates', 'Reduced minimums', 'Territory expansion', 'Sublicense rights'],
            negotiationTips: 'Negotiate performance-based royalty tiers; ensure clear termination rights'
          },
          'OTHER': { 
            keyLeverageAreas: ['Relationship value', 'Market alternatives', 'Timing', 'Payment flexibility'],
            commonConcessions: ['Price adjustments', 'Term flexibility', 'Scope modifications'],
            negotiationTips: 'Understand counterparty priorities; always have alternatives ready'
          }
        };
        const defaultNegotiation = { keyLeverageAreas: [] as string[], commonConcessions: [] as string[], negotiationTips: '' };
        const negotiationContext = NEGOTIATION_CONTEXT_BY_TYPE[detectedContractType] ?? NEGOTIATION_CONTEXT_BY_TYPE['OTHER'] ?? defaultNegotiation;
        
        // Map negotiation data from worker output to UI expected format
        const mappedLeveragePoints = (data.leveragePoints || data.strongPoints || []).map((p: any, i: number) => ({
          id: `leverage-${i}`,
          title: typeof p === 'string' ? p : (p.title || p.point || ''),
          description: typeof p === 'string' ? '' : (p.description || ''),
          category: typeof p === 'string' ? 'general' : (p.category || 'general'),
          strength: 'strong' as const,
          suggestedAction: typeof p === 'string' ? undefined : p.suggestedAction
        }));

        const mappedWeakClauses = (data.weakClauses || data.negotiationPoints || [])
          .filter((p: any) => p.priority === 'high' || !data.weakClauses)
          .map((p: any, i: number) => ({
            id: `weak-${i}`,
            clauseReference: p.clause || p.clauseReference || '',
            issue: p.concern || p.issue || p.currentTerms || '',
            impact: (p.priority === 'high' ? 'high' : p.priority === 'medium' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
            suggestedRevision: p.suggestedChange || p.suggestedRevision,
            benchmarkComparison: p.benchmarkComparison
          }));

        const mappedBenchmarkGaps = (data.benchmarkGaps || data.imbalances || []).map((g: any, i: number) => ({
          area: typeof g === 'string' ? 'Contract Term' : (g.area || 'General'),
          currentTerm: typeof g === 'string' ? g : (g.currentTerm || g.description || ''),
          marketStandard: typeof g === 'string' ? 'Industry standard' : (g.marketStandard || ''),
          gap: typeof g === 'string' ? '' : (g.gap || ''),
          recommendation: typeof g === 'string' ? '' : (g.recommendation || '')
        }));

        return (
          <>
            {ConfidenceHeader}
            {/* Negotiation Context by Contract Type */}
            <div className="mb-4 p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-lg border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-400">
                  Negotiation Strategy for {detectedContractType.replace(/_/g, ' ')} Contracts
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
                <div>
                  <span className="text-orange-400 font-medium">Your Leverage Points:</span>
                  <ul className="mt-1 space-y-0.5">
                    {negotiationContext.keyLeverageAreas.map((l, i) => (
                      <li key={i}>• {l}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-amber-400 font-medium">Common Concessions to Seek:</span>
                  <ul className="mt-1 space-y-0.5">
                    {negotiationContext.commonConcessions.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-yellow-400 font-medium">Negotiation Tips:</span>
                  <p className="mt-1">{negotiationContext.negotiationTips}</p>
                </div>
              </div>
            </div>
            <NegotiationPointsArtifact 
              data={{
                leveragePoints: mappedLeveragePoints.length > 0 ? mappedLeveragePoints : undefined,
                weakClauses: mappedWeakClauses.length > 0 ? mappedWeakClauses : undefined,
                benchmarkGaps: mappedBenchmarkGaps.length > 0 ? mappedBenchmarkGaps : undefined,
                negotiationScript: data.negotiationScript,
                overallLeverage: typeof data.favorabilityScore === 'number' 
                  ? (data.favorabilityScore >= 70 ? 'strong' : data.favorabilityScore >= 40 ? 'balanced' : 'weak')
                  : data.overallLeverage,
                summary: data.summary || data.favorabilityAssessment
              }}
            />
          </>
        );
      
      case 'amendments':
        // Map amendments from worker output to UI expected format
        const mappedAmendments = (data.amendments || []).map((a: any, i: number) => ({
          id: a.id || `amendment-${i}`,
          amendmentNumber: typeof a.number === 'number' ? a.number : (i + 1),
          effectiveDate: a.date || a.effectiveDate || '',
          title: a.title || `Amendment ${i + 1}`,
          description: a.summary || a.description || '',
          changedClauses: (a.affectedSections || []).map((section: string, j: number) => ({
            clauseId: `clause-${j}`,
            newText: section,
            changeType: 'modified' as const
          })),
          signedBy: a.parties
        }));

        const mappedChangeLog = (data.changeLog || data.changeHistory || []).map((c: any) => ({
          date: c.date || '',
          type: c.type || 'modification',
          description: c.description || '',
          reference: c.reference
        }));

        return (
          <>
            {ConfidenceHeader}
            <AmendmentsArtifact 
              data={{
                amendments: mappedAmendments,
                supersededClauses: data.supersededClauses,
                changeLog: mappedChangeLog,
                consolidatedTerms: data.consolidatedTerms,
                summary: data.summary
              }}
            />
          </>
        );
      
      case 'contacts':
        // Map contacts from worker output to UI expected format
        const allContacts = data.contacts || [];
        const mappedPrimaryContacts = (data.primaryContacts || allContacts.filter((c: any) => c.isPrimaryContact) || []).map((c: any, i: number) => ({
          id: c.id || `contact-${i}`,
          name: c.name || 'Unknown',
          role: c.role || c.title || 'Contact',
          party: c.organization || c.partyType || 'Unknown Party',
          email: c.email,
          phone: c.phone,
          address: c.address,
          isPrimary: c.isPrimaryContact
        }));

        // Map signatories to key personnel
        const mappedKeyPersonnel = (data.signatories || []).map((s: any) => ({
          name: s.name || 'Unknown',
          role: s.title || s.role || 'Signatory',
          responsibilities: ['Contract signatory'],
          party: s.organization || 'Unknown'
        }));

        // Map notice addresses
        const mappedNotificationAddresses = (data.noticeAddresses || []).map((n: any) => ({
          purpose: 'Legal notices',
          party: n.party || 'Unknown Party',
          address: n.address || '',
          format: n.attention ? `Attention: ${n.attention}` : undefined
        }));

        return (
          <>
            {ConfidenceHeader}
            <ContactsArtifact 
              data={{
                primaryContacts: mappedPrimaryContacts.length > 0 ? mappedPrimaryContacts : undefined,
                escalationPath: data.escalationPath,
                notificationAddresses: mappedNotificationAddresses.length > 0 ? mappedNotificationAddresses : data.notificationAddresses,
                keyPersonnel: mappedKeyPersonnel.length > 0 ? mappedKeyPersonnel : data.keyPersonnel,
                summary: data.summary
              }}
            />
          </>
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
    <div className={containerClasses} ref={containerRef}>
      {/* Keyboard Help Modal */}
      <AnimatePresence>
        {showKeyboardHelp && (
          <motion.div key="keyboard-help"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            onClick={() => setShowKeyboardHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </h3>
                <button onClick={() => setShowKeyboardHelp(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Next tab</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">→</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Previous tab</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">←</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Go to tab 1-9</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">1-9</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Toggle fullscreen</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">F</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Toggle edit mode</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">E</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Toggle timeline</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">T</kbd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Toggle summary</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">S</kbd>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-600">Close / Exit</span>
                  <kbd className="px-2 py-0.5 bg-slate-100 rounded text-xs">Esc</kbd>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Executive Summary Modal */}
      <AnimatePresence>
        {showSummary && (
          <motion.div key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowSummary(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-lg p-4 max-w-md w-full shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
                  <LayoutList className="h-4 w-4 text-violet-600" />
                  Executive Summary
                </h3>
                <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {executiveSummary.map((line, i) => (
                  <p key={line} className="text-xs text-slate-600 leading-relaxed">
                    {line}
                  </p>
                ))}
                {executiveSummary.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No summary available.</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button onClick={() => setShowSummary(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">
                  Close
                </button>
                <button onClick={handleExportJSON} className="px-3 py-1.5 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 flex items-center gap-1">
                  <FileDown className="h-3 w-3" />
                  Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline Modal */}
      <AnimatePresence>
        {showTimeline && (
          <motion.div key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTimeline(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-lg p-4 max-w-sm w-full shadow-xl max-h-[70vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
                  <CalendarDays className="h-4 w-4 text-violet-600" />
                  Timeline
                </h3>
                <button onClick={() => setShowTimeline(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {allDates.length > 0 ? (
                <div className="relative pl-5 space-y-3">
                  <div className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-200" />
                  {allDates.map((item, i) => (
                    <div key={`${item.label}-${item.date}`} className="relative">
                      <div className={cn(
                        "absolute -left-3.5 w-3 h-3 rounded-full border-2 bg-white",
                        item.type === 'start' ? "border-violet-500" :
                        item.type === 'end' ? "border-red-500" :
                        item.type === 'deadline' ? "border-amber-500" :
                        "border-violet-500"
                      )} />
                      <div>
                        <div className="text-xs font-medium text-slate-700">{item.label}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-6">
                  No dates found.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Items Modal */}
      <AnimatePresence>
        {showActionItems && (
          <motion.div key="action-items"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowActionItems(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-lg p-4 max-w-md w-full shadow-xl max-h-[70vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
                  <Target className="h-4 w-4 text-violet-600" />
                  Action Items
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{actionItems.length}</span>
                </h3>
                <button onClick={() => setShowActionItems(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {actionItems.length > 0 ? (
                <div className="space-y-2">
                  {actionItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "px-2.5 py-2 rounded border flex items-center gap-2",
                        item.priority === 'urgent' && "bg-rose-50/50 border-rose-100",
                        item.priority === 'high' && "bg-amber-50/50 border-amber-100",
                        item.priority === 'medium' && "bg-violet-50/50 border-violet-100",
                        item.priority === 'low' && "bg-slate-50 border-slate-100"
                      )}
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        item.priority === 'urgent' && "bg-rose-500",
                        item.priority === 'high' && "bg-amber-500",
                        item.priority === 'medium' && "bg-violet-500",
                        item.priority === 'low' && "bg-slate-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{item.action}</p>
                        <p className="text-[10px] text-slate-400">{item.category}</p>
                      </div>
                      <button
                        className="text-[10px] text-violet-600 hover:text-violet-700 font-medium shrink-0"
                        onClick={() => {
                          setActiveTab(item.source as TabId);
                          setShowActionItems(false);
                        }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Check className="h-8 w-8 text-violet-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">All clear!</p>
                  <p className="text-xs text-slate-400 mt-0.5">No action items found.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Human Review Banner - Shows when AI confidence is low */}
      {confidenceInfo.needsHumanReview && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 flex-1">
            <span className="font-medium">Review recommended</span> — AI confidence is {confidenceInfo.avgConfidence}%
          </p>
          <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
            {confidenceInfo.avgConfidence}%
          </span>
        </motion.div>
      )}

      {/* Contract Type Badge */}
      {detectedContractType && detectedContractType !== 'OTHER' && (
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-700 border border-indigo-100 rounded-md text-xs font-medium">
            <FileText className="h-3 w-3" />
            {detectedContractType.replace(/_/g, ' ')}
          </span>
          {contractInsights.keyFocus.slice(0, 3).map((focus, i) => (
            <span key={i} className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded">
              {focus}
            </span>
          ))}
        </div>
      )}

      {/* Smart Suggestions Panel */}
      {smartSuggestions.length > 0 && (
        <div className="mb-3">
          <details className="group">
            <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
              <Lightbulb className="h-3 w-3 text-amber-500" />
              <span>{smartSuggestions.length} AI Suggestion{smartSuggestions.length > 1 ? 's' : ''}</span>
              <ChevronDown className="h-3 w-3 text-slate-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2 space-y-1">
              {smartSuggestions.map((suggestion, i) => (
                <div
                  key={`${suggestion.category}-${suggestion.suggestion}`}
                  className={cn(
                    "px-2.5 py-1.5 rounded border text-xs flex items-center gap-2",
                    suggestion.priority === 'high' 
                      ? "bg-red-50/50 border-red-100 text-red-700"
                      : suggestion.priority === 'medium'
                      ? "bg-amber-50/50 border-amber-100 text-amber-700"
                      : "bg-violet-50/50 border-violet-100 text-violet-700"
                  )}
                >
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    suggestion.priority === 'high' ? "bg-red-500" : 
                    suggestion.priority === 'medium' ? "bg-amber-500" : "bg-violet-500"
                  )} />
                  <span className="font-medium">{suggestion.category}:</span>
                  <span className="text-slate-600">{suggestion.suggestion}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Quick Stats Bar - Compact horizontal layout */}
      <div className="flex flex-wrap gap-2 mb-3">
        {stats.totalValue && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 border border-violet-100 rounded-md">
            <DollarSign className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-xs font-semibold text-violet-700">${(stats.totalValue / 1000).toFixed(0)}K</span>
          </div>
        )}
        
        {stats.clauseCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 border border-violet-100 rounded-md">
            <FileCheck className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-xs font-semibold text-violet-700">{stats.clauseCount} clauses</span>
          </div>
        )}
        
        {stats.riskScore !== null && (
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md",
            stats.riskScore < 30 ? "bg-violet-50 border-violet-100" : stats.riskScore < 60 ? "bg-amber-50 border-amber-100" : "bg-rose-50 border-rose-100"
          )}>
            <AlertTriangle className={cn(
              "h-3.5 w-3.5",
              stats.riskScore < 30 ? "text-violet-600" : stats.riskScore < 60 ? "text-amber-600" : "text-rose-600"
            )} />
            <span className={cn(
              "text-xs font-semibold",
              stats.riskScore < 30 ? "text-violet-700" : stats.riskScore < 60 ? "text-amber-700" : "text-rose-700"
            )}>Risk {stats.riskScore}</span>
          </div>
        )}
        
        {stats.complianceScore !== null && (
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md",
            stats.complianceScore >= 90 ? "bg-violet-50 border-violet-100" : stats.complianceScore >= 70 ? "bg-amber-50 border-amber-100" : "bg-rose-50 border-rose-100"
          )}>
            <Shield className={cn(
              "h-3.5 w-3.5",
              stats.complianceScore >= 90 ? "text-violet-600" : stats.complianceScore >= 70 ? "text-amber-600" : "text-rose-600"
            )} />
            <span className={cn(
              "text-xs font-semibold",
              stats.complianceScore >= 90 ? "text-violet-700" : stats.complianceScore >= 70 ? "text-amber-700" : "text-rose-700"
            )}>{stats.complianceScore}%</span>
          </div>
        )}
      </div>

      {/* Contract Health Score Panel */}
      <div className={cn(
        "mb-3 px-3 py-2.5 rounded-lg border flex items-center justify-between",
        contractHealth.status === 'excellent' && "bg-violet-50/50 border-violet-100",
        contractHealth.status === 'good' && "bg-violet-50/50 border-violet-100",
        contractHealth.status === 'fair' && "bg-amber-50/50 border-amber-100",
        contractHealth.status === 'poor' && "bg-rose-50/50 border-rose-100"
      )}>
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            contractHealth.status === 'excellent' && "bg-violet-100 text-violet-700",
            contractHealth.status === 'good' && "bg-violet-100 text-violet-700",
            contractHealth.status === 'fair' && "bg-amber-100 text-amber-700",
            contractHealth.status === 'poor' && "bg-rose-100 text-rose-700"
          )}>
            {contractHealth.score}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-700">Health Score</p>
            <p className="text-[10px] text-slate-400 capitalize">{contractHealth.status}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {contractHealth.factors.slice(0, 3).map((factor, i) => (
            <span 
              key={factor.label}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                factor.status === 'good' && "bg-violet-100 text-violet-600",
                factor.status === 'warning' && "bg-amber-100 text-amber-600",
                factor.status === 'critical' && "bg-rose-100 text-rose-600"
              )}
            >
              {factor.label}
            </span>
          ))}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSummary(true)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <LayoutList className="h-3.5 w-3.5" />
            Summary
          </button>
          <button
            onClick={() => setShowTimeline(true)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Timeline
            {allDates.length > 0 && (
              <span className="ml-0.5 px-1 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded">{allDates.length}</span>
            )}
          </button>
          <button
            onClick={() => setShowActionItems(true)}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
              actionItems.some(i => i.priority === 'urgent') 
                ? "text-rose-600 hover:bg-rose-50" 
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            )}
          >
            <Target className="h-3.5 w-3.5" />
            Actions
            {actionItems.length > 0 && (
              <span className={cn(
                "ml-0.5 px-1 py-0.5 text-[10px] rounded",
                actionItems.some(i => i.priority === 'urgent') 
                  ? "bg-rose-100 text-rose-600" 
                  : "bg-slate-200 text-slate-600"
              )}>
                {actionItems.length}
              </span>
            )}
          </button>
          {bookmarkedClauses.size > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-600 bg-violet-50 rounded-md">
              <BookmarkPlus className="h-3 w-3" />
              {bookmarkedClauses.size}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportJSON}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Export to JSON"
          >
            <FileDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowKeyboardHelp(true)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-white">
          <div className="px-4 py-1.5">
            {/* Tab Pills - sorted by priority for contract type */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {sortedTabs.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const hasData = normalizedData[tab.id as keyof typeof normalizedData] !== null;
                const notApplicable = isTabNotApplicable(tab.id);
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all shrink-0 rounded-md",
                      isActive 
                        ? "bg-violet-50 text-violet-700 ring-1 ring-indigo-200"
                        : hasData
                        ? "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                        : "text-slate-400 hover:text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <Icon className={cn(
                      "h-3.5 w-3.5",
                      isActive ? "text-violet-600" : hasData ? "text-slate-500" : "text-slate-400"
                    )} />
                    <span>{tab.label}</span>
                    {/* Data indicator dot */}
                    {hasData && !isActive && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-violet-400 rounded-full" />
                    )}
                    {notApplicable && !isActive && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
              
              {/* Progress indicator */}
              <div className="ml-auto flex items-center gap-2 pl-4">
                <div className="flex items-center bg-slate-100 rounded-md p-0.5">
                  <button
                    onClick={() => setViewMode('view')}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
                      viewMode === 'view' 
                        ? "bg-white text-slate-700 shadow-sm" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </button>
                  <button
                    onClick={() => setViewMode('edit')}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all",
                      viewMode === 'edit' 
                        ? "bg-white text-violet-600 shadow-sm" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </button>
                </div>
                
                {/* Legend for indicator dots */}
                <div className="hidden md:flex items-center gap-3 pl-3 border-l border-slate-200 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                    Has data
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    N/A
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-4">
          {/* Show SmartEditableArtifact in edit mode */}
          {viewMode === 'edit' ? (
            <SmartEditableArtifact
              artifactId={contractId}
              artifactType="contract"
              title="Contract Data"
              sections={editableSections}
              onSave={handleSaveArtifact}
              onAIEnhance={handleAIEnhance}
              onRegenerate={handleRegenerate}
              enableAI={true}
              enableComments={true}
            />
          ) : (
            /* Tab Content */
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderTabContent()}
                
                {/* Feedback bar — shown when artifact has data and an ID */}
                {normalizedData[activeTab as keyof typeof normalizedData] && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <ArtifactFeedback
                      contractId={contractId}
                      artifactId={artifactIds[activeTab] || artifactIds[activeTab.toUpperCase()] || ''}
                      artifactType={activeTab.toUpperCase()}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </CardContent>

        {/* Footer Navigation - only show in view mode */}
        {viewMode === 'view' && (
        <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/30 flex items-center justify-between">
          <button
            onClick={goToPrevTab}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors px-2 py-1 rounded hover:bg-slate-100"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          
          <div className="flex items-center gap-1.5">
            {sortedTabs.slice(0, 7).map((tab) => {
              const hasData = normalizedData[tab.id as keyof typeof normalizedData] !== null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    activeTab === tab.id 
                      ? "w-4 bg-violet-500"
                      : hasData
                      ? "bg-slate-300 hover:bg-slate-400"
                      : "bg-slate-200"
                  )}
                  title={tab.label}
                />
              );
            })}
          </div>
          
          <button
            onClick={goToNextTab}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors px-2 py-1 rounded hover:bg-slate-100"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        )}
      </Card>
    </div>
  );
}

export default EnhancedArtifactViewer;
