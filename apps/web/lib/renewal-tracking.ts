// Contract Renewal Tracking Service for Procurement Intelligence
// Proactive contract renewal management and negotiation preparation

export interface ContractRenewal {
  contractId: string;
  contractTitle: string;
  supplier: string;
  currentValue: number;
  effectiveDate: Date;
  expirationDate: Date;
  renewalDate?: Date;
  autoRenewal: boolean;
  noticePeriod: number; // Days required for termination notice
  renewalTerms?: RenewalTerms;
  status: RenewalStatus;
  urgencyLevel: UrgencyLevel;
  daysUntilExpiration: number;
  daysUntilRenewalAction: number;
  category: ContractCategory;
  strategicImportance: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface RenewalTerms {
  renewalPeriod: number; // Months
  priceEscalation?: number; // Percentage
  volumeCommitments?: VolumeCommitment[];
  performanceMetrics?: PerformanceMetric[];
  terminationClauses: string[];
  renegotiationTriggers: string[];
}

export interface VolumeCommitment {
  metric: string;
  minimumVolume: number;
  discountTier: number;
  penaltyRate?: number;
}

export interface PerformanceMetric {
  name: string;
  target: number;
  measurement: string;
  penalty?: string;
  bonus?: string;
}

export type RenewalStatus = 
  | 'Active'
  | 'Renewal Due'
  | 'Under Review'
  | 'Negotiating'
  | 'Renewed'
  | 'Terminated'
  | 'Expired';

export type UrgencyLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type ContractCategory = 
  | 'Professional Services'
  | 'Software Licenses'
  | 'Infrastructure'
  | 'Consulting'
  | 'Maintenance'
  | 'Support';

export interface RenewalAlert {
  contractId: string;
  alertType: 'Renewal Due' | 'Notice Required' | 'Negotiation Window' | 'Auto-Renewal Warning' | 'Expiration Imminent';
  message: string;
  actionRequired: string;
  dueDate: Date;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignedTo?: string;
  estimatedEffort: string;
  potentialImpact: string;
}

export interface RenewalTimeline {
  contractId: string;
  milestones: RenewalMilestone[];
  criticalPath: string[];
  totalDuration: number; // Days
  bufferTime: number; // Days
}

export interface RenewalMilestone {
  name: string;
  description: string;
  dueDate: Date;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Overdue';
  dependencies: string[];
  assignedTo?: string;
  estimatedHours: number;
}

export interface RenewalStrategy {
  contractId: string;
  approach: 'Renew' | 'Renegotiate' | 'Replace' | 'Terminate';
  rationale: string;
  keyObjectives: string[];
  negotiationPoints: NegotiationPoint[];
  alternativeOptions: AlternativeOption[];
  riskAssessment: RiskAssessment;
  expectedOutcome: ExpectedOutcome;
}

export interface NegotiationPoint {
  category: 'Pricing' | 'Terms' | 'Performance' | 'Scope' | 'Risk';
  description: string;
  currentState: string;
  targetState: string;
  leverage: 'High' | 'Medium' | 'Low';
  importance: 'High' | 'Medium' | 'Low';
  fallbackPosition: string;
}

export interface AlternativeOption {
  supplier: string;
  estimatedCost: number;
  advantages: string[];
  disadvantages: string[];
  transitionEffort: 'Low' | 'Medium' | 'High';
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface RiskAssessment {
  supplierRisk: 'Low' | 'Medium' | 'High';
  marketRisk: 'Low' | 'Medium' | 'High';
  operationalRisk: 'Low' | 'Medium' | 'High';
  financialRisk: 'Low' | 'Medium' | 'High';
  mitigationStrategies: string[];
}

export interface ExpectedOutcome {
  costSavings: number;
  serviceImprovements: string[];
  riskReduction: string[];
  timeline: string;
  successProbability: number;
}

export class RenewalTrackingService {
  private renewals: Map<string, ContractRenewal>;
  private alerts: Map<string, RenewalAlert[]>;
  private strategies: Map<string, RenewalStrategy>;
  private timelines: Map<string, RenewalTimeline>;

  constructor() {
    this.renewals = new Map();
    this.alerts = new Map();
    this.strategies = new Map();
    this.timelines = new Map();
  }

  /**
   * Track a new contract for renewal management
   */
  trackContract(contract: {
    id: string;
    title: string;
    supplier: string;
    value: number;
    effectiveDate: Date;
    expirationDate: Date;
    autoRenewal?: boolean;
    noticePeriod?: number;
    category?: ContractCategory;
    strategicImportance?: 'Low' | 'Medium' | 'High' | 'Critical';
  }): ContractRenewal {
    const today = new Date();
    const daysUntilExpiration = Math.ceil((contract.expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const noticePeriod = contract.noticePeriod || 90;
    const daysUntilRenewalAction = daysUntilExpiration - noticePeriod;

    const renewal: ContractRenewal = {
      contractId: contract.id,
      contractTitle: contract.title,
      supplier: contract.supplier,
      currentValue: contract.value,
      effectiveDate: contract.effectiveDate,
      expirationDate: contract.expirationDate,
      autoRenewal: contract.autoRenewal || false,
      noticePeriod,
      status: this.determineRenewalStatus(daysUntilExpiration, daysUntilRenewalAction),
      urgencyLevel: this.calculateUrgencyLevel(daysUntilExpiration, contract.value, contract.strategicImportance),
      daysUntilExpiration,
      daysUntilRenewalAction,
      category: contract.category || 'Professional Services',
      strategicImportance: contract.strategicImportance || 'Medium'
    };

    this.renewals.set(contract.id, renewal);
    this.generateRenewalAlerts(renewal);
    this.createRenewalTimeline(renewal);

    return renewal;
  }

  /**
   * Get all contracts due for renewal within specified timeframe
   */
  getContractsDueForRenewal(timeframeDays: number = 180): ContractRenewal[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + timeframeDays);

    return Array.from(this.renewals.values())
      .filter(renewal => renewal.expirationDate <= cutoffDate)
      .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }

  /**
   * Get contracts by urgency level
   */
  getContractsByUrgency(urgencyLevel: UrgencyLevel): ContractRenewal[] {
    return Array.from(this.renewals.values())
      .filter(renewal => renewal.urgencyLevel === urgencyLevel)
      .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }

  /**
   * Get all active alerts
   */
  getAllAlerts(): RenewalAlert[] {
    const allAlerts: RenewalAlert[] = [];
    for (const alerts of this.alerts.values()) {
      allAlerts.push(...alerts);
    }
    return allAlerts.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get alerts for specific contract
   */
  getContractAlerts(contractId: string): RenewalAlert[] {
    return this.alerts.get(contractId) || [];
  }

  /**
   * Generate renewal strategy for a contract
   */
  generateRenewalStrategy(contractId: string, marketData?: any): RenewalStrategy {
    const renewal = this.renewals.get(contractId);
    if (!renewal) {
      throw new Error(`Contract ${contractId} not found`);
    }

    const strategy: RenewalStrategy = {
      contractId,
      approach: this.determineRenewalApproach(renewal, marketData),
      rationale: this.generateRationale(renewal, marketData),
      keyObjectives: this.identifyKeyObjectives(renewal),
      negotiationPoints: this.identifyNegotiationPoints(renewal, marketData),
      alternativeOptions: this.identifyAlternatives(renewal),
      riskAssessment: this.assessRenewalRisks(renewal),
      expectedOutcome: this.projectExpectedOutcome(renewal, marketData)
    };

    this.strategies.set(contractId, strategy);
    return strategy;
  }

  /**
   * Update contract renewal status
   */
  updateRenewalStatus(contractId: string, status: RenewalStatus, notes?: string): void {
    const renewal = this.renewals.get(contractId);
    if (renewal) {
      renewal.status = status;
      
      // Update alerts based on new status
      if (status === 'Renewed' || status === 'Terminated') {
        this.alerts.delete(contractId);
      } else {
        this.generateRenewalAlerts(renewal);
      }
    }
  }

  /**
   * Get renewal timeline for contract
   */
  getRenewalTimeline(contractId: string): RenewalTimeline | undefined {
    return this.timelines.get(contractId);
  }

  /**
   * Get renewal dashboard summary
   */
  getRenewalDashboard(): {
    totalContracts: number;
    contractsByUrgency: Record<UrgencyLevel, number>;
    contractsByStatus: Record<RenewalStatus, number>;
    totalValue: number;
    upcomingRenewals: ContractRenewal[];
    criticalAlerts: RenewalAlert[];
  } {
    const allRenewals = Array.from(this.renewals.values());
    const allAlerts = this.getAllAlerts();

    const contractsByUrgency = {
      'Low': allRenewals.filter(r => r.urgencyLevel === 'Low').length,
      'Medium': allRenewals.filter(r => r.urgencyLevel === 'Medium').length,
      'High': allRenewals.filter(r => r.urgencyLevel === 'High').length,
      'Critical': allRenewals.filter(r => r.urgencyLevel === 'Critical').length
    };

    const contractsByStatus = {
      'Active': allRenewals.filter(r => r.status === 'Active').length,
      'Renewal Due': allRenewals.filter(r => r.status === 'Renewal Due').length,
      'Under Review': allRenewals.filter(r => r.status === 'Under Review').length,
      'Negotiating': allRenewals.filter(r => r.status === 'Negotiating').length,
      'Renewed': allRenewals.filter(r => r.status === 'Renewed').length,
      'Terminated': allRenewals.filter(r => r.status === 'Terminated').length,
      'Expired': allRenewals.filter(r => r.status === 'Expired').length
    };

    return {
      totalContracts: allRenewals.length,
      contractsByUrgency,
      contractsByStatus,
      totalValue: allRenewals.reduce((sum, r) => sum + r.currentValue, 0),
      upcomingRenewals: this.getContractsDueForRenewal(90),
      criticalAlerts: allAlerts.filter(a => a.priority === 'Critical')
    };
  }

  /**
   * Determine renewal status based on timeline
   */
  private determineRenewalStatus(daysUntilExpiration: number, daysUntilRenewalAction: number): RenewalStatus {
    if (daysUntilExpiration <= 0) {
      return 'Expired';
    } else if (daysUntilExpiration <= 30) {
      return 'Renewal Due';
    } else if (daysUntilRenewalAction <= 0) {
      return 'Under Review';
    } else {
      return 'Active';
    }
  }

  /**
   * Calculate urgency level based on timeline, value, and importance
   */
  private calculateUrgencyLevel(
    daysUntilExpiration: number, 
    value: number, 
    strategicImportance?: string
  ): UrgencyLevel {
    let urgencyScore = 0;

    // Timeline factor
    if (daysUntilExpiration <= 30) urgencyScore += 4;
    else if (daysUntilExpiration <= 60) urgencyScore += 3;
    else if (daysUntilExpiration <= 90) urgencyScore += 2;
    else if (daysUntilExpiration <= 180) urgencyScore += 1;

    // Value factor
    if (value >= 1000000) urgencyScore += 3;
    else if (value >= 500000) urgencyScore += 2;
    else if (value >= 100000) urgencyScore += 1;

    // Strategic importance factor
    if (strategicImportance === 'Critical') urgencyScore += 3;
    else if (strategicImportance === 'High') urgencyScore += 2;
    else if (strategicImportance === 'Medium') urgencyScore += 1;

    if (urgencyScore >= 8) return 'Critical';
    else if (urgencyScore >= 6) return 'High';
    else if (urgencyScore >= 3) return 'Medium';
    else return 'Low';
  }

  /**
   * Generate renewal alerts for a contract
   */
  private generateRenewalAlerts(renewal: ContractRenewal): void {
    const alerts: RenewalAlert[] = [];
    const today = new Date();

    // Notice period alert
    if (renewal.daysUntilRenewalAction <= 30 && renewal.daysUntilRenewalAction > 0) {
      alerts.push({
        contractId: renewal.contractId,
        alertType: 'Notice Required',
        message: `Contract renewal notice required within ${renewal.daysUntilRenewalAction} days`,
        actionRequired: 'Prepare renewal notice and strategy',
        dueDate: new Date(today.getTime() + renewal.daysUntilRenewalAction * 24 * 60 * 60 * 1000),
        priority: renewal.urgencyLevel,
        estimatedEffort: '4-8 hours',
        potentialImpact: 'Service disruption if not addressed'
      });
    }

    // Auto-renewal warning
    if (renewal.autoRenewal && renewal.daysUntilExpiration <= 60) {
      alerts.push({
        contractId: renewal.contractId,
        alertType: 'Auto-Renewal Warning',
        message: 'Contract will auto-renew unless action is taken',
        actionRequired: 'Review terms and decide on renewal or termination',
        dueDate: new Date(today.getTime() + (renewal.daysUntilExpiration - renewal.noticePeriod) * 24 * 60 * 60 * 1000),
        priority: 'High',
        estimatedEffort: '2-4 hours',
        potentialImpact: 'Unwanted contract extension'
      });
    }

    // Expiration imminent
    if (renewal.daysUntilExpiration <= 7) {
      alerts.push({
        contractId: renewal.contractId,
        alertType: 'Expiration Imminent',
        message: `Contract expires in ${renewal.daysUntilExpiration} days`,
        actionRequired: 'Immediate action required to prevent service disruption',
        dueDate: renewal.expirationDate,
        priority: 'Critical',
        estimatedEffort: 'Immediate',
        potentialImpact: 'Service disruption'
      });
    }

    this.alerts.set(renewal.contractId, alerts);
  }

  /**
   * Create renewal timeline with milestones
   */
  private createRenewalTimeline(renewal: ContractRenewal): void {
    const milestones: RenewalMilestone[] = [];
    const today = new Date();
    
    // Strategy development
    const strategyDate = new Date(today.getTime() + (renewal.daysUntilRenewalAction - 60) * 24 * 60 * 60 * 1000);
    milestones.push({
      name: 'Strategy Development',
      description: 'Develop renewal strategy and objectives',
      dueDate: strategyDate,
      status: 'Not Started',
      dependencies: [],
      estimatedHours: 8
    });

    // Market research
    const researchDate = new Date(today.getTime() + (renewal.daysUntilRenewalAction - 45) * 24 * 60 * 60 * 1000);
    milestones.push({
      name: 'Market Research',
      description: 'Research market rates and alternatives',
      dueDate: researchDate,
      status: 'Not Started',
      dependencies: ['Strategy Development'],
      estimatedHours: 16
    });

    // Negotiation preparation
    const prepDate = new Date(today.getTime() + (renewal.daysUntilRenewalAction - 30) * 24 * 60 * 60 * 1000);
    milestones.push({
      name: 'Negotiation Preparation',
      description: 'Prepare negotiation materials and fallback positions',
      dueDate: prepDate,
      status: 'Not Started',
      dependencies: ['Market Research'],
      estimatedHours: 12
    });

    // Supplier engagement
    const engagementDate = new Date(today.getTime() + (renewal.daysUntilRenewalAction - 15) * 24 * 60 * 60 * 1000);
    milestones.push({
      name: 'Supplier Engagement',
      description: 'Initiate renewal discussions with supplier',
      dueDate: engagementDate,
      status: 'Not Started',
      dependencies: ['Negotiation Preparation'],
      estimatedHours: 4
    });

    const timeline: RenewalTimeline = {
      contractId: renewal.contractId,
      milestones,
      criticalPath: ['Strategy Development', 'Market Research', 'Negotiation Preparation', 'Supplier Engagement'],
      totalDuration: 60,
      bufferTime: 15
    };

    this.timelines.set(renewal.contractId, timeline);
  }

  /**
   * Determine optimal renewal approach
   */
  private determineRenewalApproach(renewal: ContractRenewal, marketData?: any): 'Renew' | 'Renegotiate' | 'Replace' | 'Terminate' {
    // Simplified logic - in practice, this would be more sophisticated
    if (renewal.currentValue > 500000 || renewal.strategicImportance === 'Critical') {
      return 'Renegotiate';
    } else if (renewal.strategicImportance === 'Low') {
      return 'Replace';
    } else {
      return 'Renew';
    }
  }

  /**
   * Generate rationale for renewal approach
   */
  private generateRationale(renewal: ContractRenewal, marketData?: any): string {
    return `Based on contract value of ${renewal.currentValue.toLocaleString()} and strategic importance level of ${renewal.strategicImportance}, recommend comprehensive review and negotiation to optimize terms and pricing.`;
  }

  /**
   * Identify key objectives for renewal
   */
  private identifyKeyObjectives(renewal: ContractRenewal): string[] {
    const objectives = [
      'Optimize pricing and terms',
      'Improve service levels',
      'Reduce risk exposure',
      'Align with business strategy'
    ];

    if (renewal.currentValue > 1000000) {
      objectives.push('Achieve significant cost savings');
    }

    if (renewal.strategicImportance === 'Critical') {
      objectives.push('Ensure service continuity');
    }

    return objectives;
  }

  /**
   * Identify negotiation points
   */
  private identifyNegotiationPoints(renewal: ContractRenewal, marketData?: any): NegotiationPoint[] {
    return [
      {
        category: 'Pricing',
        description: 'Reduce hourly rates to market median',
        currentState: 'Above market rates',
        targetState: 'Market-aligned rates',
        leverage: 'High',
        importance: 'High',
        fallbackPosition: '5% reduction minimum'
      },
      {
        category: 'Terms',
        description: 'Improve payment terms',
        currentState: 'Net 30 days',
        targetState: 'Net 45 days',
        leverage: 'Medium',
        importance: 'Medium',
        fallbackPosition: 'Maintain current terms'
      }
    ];
  }

  /**
   * Identify alternative options
   */
  private identifyAlternatives(renewal: ContractRenewal): AlternativeOption[] {
    return [
      {
        supplier: 'Alternative Supplier A',
        estimatedCost: renewal.currentValue * 0.85,
        advantages: ['15% cost savings', 'Modern technology stack'],
        disadvantages: ['Transition effort', 'Unknown performance'],
        transitionEffort: 'Medium',
        riskLevel: 'Medium'
      }
    ];
  }

  /**
   * Assess renewal risks
   */
  private assessRenewalRisks(renewal: ContractRenewal): RiskAssessment {
    return {
      supplierRisk: 'Low',
      marketRisk: 'Medium',
      operationalRisk: 'Low',
      financialRisk: 'Medium',
      mitigationStrategies: [
        'Maintain alternative supplier relationships',
        'Implement performance monitoring',
        'Establish clear SLAs'
      ]
    };
  }

  /**
   * Project expected outcome
   */
  private projectExpectedOutcome(renewal: ContractRenewal, marketData?: any): ExpectedOutcome {
    return {
      costSavings: renewal.currentValue * 0.1, // 10% savings target
      serviceImprovements: ['Enhanced SLAs', 'Better reporting'],
      riskReduction: ['Improved contract terms', 'Performance guarantees'],
      timeline: '3-6 months',
      successProbability: 0.8
    };
  }
}

// Export singleton instance
export const renewalTracker = new RenewalTrackingService();

// Utility functions
export function calculateDaysUntilExpiration(expirationDate: Date): number {
  const today = new Date();
  return Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatRenewalDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function getUrgencyColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'Critical': return '#dc2626'; // red-600
    case 'High': return '#ea580c'; // orange-600
    case 'Medium': return '#ca8a04'; // yellow-600
    case 'Low': return '#16a34a'; // green-600
    default: return '#6b7280'; // gray-500
  }
}