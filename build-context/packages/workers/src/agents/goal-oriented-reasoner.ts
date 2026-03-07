import pino from 'pino';

const logger = pino({ name: 'goal-oriented-reasoner' });

/**
 * User Goals and Intents
 */
export enum UserGoal {
  NEGOTIATE = 'negotiate',
  RISK_ASSESSMENT = 'risk_assessment',
  COST_OPTIMIZATION = 'cost_optimization',
  COMPLIANCE_CHECK = 'compliance_check',
  RENEWAL_PREP = 'renewal_prep',
  QUICK_REVIEW = 'quick_review',
  DEEP_ANALYSIS = 'deep_analysis',
}

export interface DetectedIntent {
  primaryGoal: UserGoal;
  secondaryGoals: UserGoal[];
  confidence: number;
  signals: string[];
  context: {
    contractType?: string;
    urgency?: 'low' | 'medium' | 'high';
    userRole?: string;
    deadline?: Date;
  };
}

export interface GoalBasedPlan {
  goal: UserGoal;
  prioritizedArtifacts: Array<{
    type: string;
    priority: number;
    reasoning: string;
  }>;
  skipArtifacts: string[];
  optimizations: string[];
  estimatedValue: number;
}

/**
 * Goal-Oriented Reasoning Engine
 * Detects user intent and optimizes workflow accordingly
 */
export class GoalOrientedReasoner {
  /**
   * Detect user intent from various signals
   */
  async detectIntent(signals: {
    userQuery?: string;
    contractType?: string;
    userRole?: string;
    previousActions?: string[];
    contractMetadata?: Record<string, any>;
  }): Promise<DetectedIntent> {
    const { userQuery, contractType, userRole, previousActions, contractMetadata } = signals;

    const goalScores = new Map<UserGoal, number>();

    // Initialize all goals with base score
    for (const goal of Object.values(UserGoal)) {
      goalScores.set(goal as UserGoal, 0);
    }

    // Analyze user query
    if (userQuery) {
      const query = userQuery.toLowerCase();

      if (query.includes('negotiate') || query.includes('negotiation') || query.includes('better rate')) {
        goalScores.set(UserGoal.NEGOTIATE, goalScores.get(UserGoal.NEGOTIATE)! + 0.4);
      }

      if (query.includes('risk') || query.includes('liability') || query.includes('exposure')) {
        goalScores.set(UserGoal.RISK_ASSESSMENT, goalScores.get(UserGoal.RISK_ASSESSMENT)! + 0.4);
      }

      if (query.includes('cost') || query.includes('savings') || query.includes('optimize') || query.includes('reduce')) {
        goalScores.set(UserGoal.COST_OPTIMIZATION, goalScores.get(UserGoal.COST_OPTIMIZATION)! + 0.4);
      }

      if (query.includes('compliance') || query.includes('regulatory') || query.includes('gdpr') || query.includes('soc2')) {
        goalScores.set(UserGoal.COMPLIANCE_CHECK, goalScores.get(UserGoal.COMPLIANCE_CHECK)! + 0.4);
      }

      if (query.includes('renewal') || query.includes('renew') || query.includes('expir')) {
        goalScores.set(UserGoal.RENEWAL_PREP, goalScores.get(UserGoal.RENEWAL_PREP)! + 0.4);
      }

      if (query.includes('quick') || query.includes('summary') || query.includes('overview')) {
        goalScores.set(UserGoal.QUICK_REVIEW, goalScores.get(UserGoal.QUICK_REVIEW)! + 0.4);
      }

      if (query.includes('deep') || query.includes('detailed') || query.includes('thorough') || query.includes('comprehensive')) {
        goalScores.set(UserGoal.DEEP_ANALYSIS, goalScores.get(UserGoal.DEEP_ANALYSIS)! + 0.4);
      }
    }

    // Infer from user role
    if (userRole) {
      const role = userRole.toLowerCase();

      if (role.includes('legal') || role.includes('counsel')) {
        goalScores.set(UserGoal.COMPLIANCE_CHECK, goalScores.get(UserGoal.COMPLIANCE_CHECK)! + 0.2);
        goalScores.set(UserGoal.RISK_ASSESSMENT, goalScores.get(UserGoal.RISK_ASSESSMENT)! + 0.2);
      }

      if (role.includes('procurement') || role.includes('sourcing')) {
        goalScores.set(UserGoal.COST_OPTIMIZATION, goalScores.get(UserGoal.COST_OPTIMIZATION)! + 0.2);
        goalScores.set(UserGoal.NEGOTIATE, goalScores.get(UserGoal.NEGOTIATE)! + 0.2);
      }

      if (role.includes('finance') || role.includes('cfo')) {
        goalScores.set(UserGoal.COST_OPTIMIZATION, goalScores.get(UserGoal.COST_OPTIMIZATION)! + 0.3);
      }

      if (role.includes('compliance') || role.includes('risk')) {
        goalScores.set(UserGoal.COMPLIANCE_CHECK, goalScores.get(UserGoal.COMPLIANCE_CHECK)! + 0.3);
        goalScores.set(UserGoal.RISK_ASSESSMENT, goalScores.get(UserGoal.RISK_ASSESSMENT)! + 0.2);
      }
    }

    // Infer from contract type
    if (contractType) {
      const type = contractType.toLowerCase();

      if (type.includes('service') || type.includes('sow')) {
        goalScores.set(UserGoal.NEGOTIATE, goalScores.get(UserGoal.NEGOTIATE)! + 0.15);
        goalScores.set(UserGoal.COST_OPTIMIZATION, goalScores.get(UserGoal.COST_OPTIMIZATION)! + 0.15);
      }

      if (type.includes('nda') || type.includes('confidentiality')) {
        goalScores.set(UserGoal.COMPLIANCE_CHECK, goalScores.get(UserGoal.COMPLIANCE_CHECK)! + 0.2);
        goalScores.set(UserGoal.QUICK_REVIEW, goalScores.get(UserGoal.QUICK_REVIEW)! + 0.15);
      }

      if (type.includes('master') || type.includes('msa')) {
        goalScores.set(UserGoal.DEEP_ANALYSIS, goalScores.get(UserGoal.DEEP_ANALYSIS)! + 0.2);
        goalScores.set(UserGoal.RISK_ASSESSMENT, goalScores.get(UserGoal.RISK_ASSESSMENT)! + 0.15);
      }
    }

    // Check for renewal urgency
    if (contractMetadata?.expirationDate) {
      const expDate = new Date(contractMetadata.expirationDate);
      const now = new Date();
      const daysToExpiration = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (daysToExpiration < 90 && daysToExpiration > 0) {
        goalScores.set(UserGoal.RENEWAL_PREP, goalScores.get(UserGoal.RENEWAL_PREP)! + 0.3);
      }
    }

    // Analyze previous actions
    if (previousActions && previousActions.length > 0) {
      const actions = previousActions.map(a => a.toLowerCase());

      if (actions.some(a => a.includes('negotiate') || a.includes('rates'))) {
        goalScores.set(UserGoal.NEGOTIATE, goalScores.get(UserGoal.NEGOTIATE)! + 0.1);
      }

      if (actions.some(a => a.includes('risk') || a.includes('compliance'))) {
        goalScores.set(UserGoal.RISK_ASSESSMENT, goalScores.get(UserGoal.RISK_ASSESSMENT)! + 0.1);
        goalScores.set(UserGoal.COMPLIANCE_CHECK, goalScores.get(UserGoal.COMPLIANCE_CHECK)! + 0.1);
      }
    }

    // Sort goals by score
    const sortedGoals = Array.from(goalScores.entries())
      .sort((a, b) => b[1] - a[1]);

    const primaryGoal = sortedGoals[0]![0];
    const confidence = sortedGoals[0]![1];
    const secondaryGoals = sortedGoals
      .slice(1, 4)
      .filter(([_, score]) => score > 0.2)
      .map(([goal]) => goal);

    const detectedSignals: string[] = [];
    if (userQuery) detectedSignals.push(`Query: "${userQuery}"`);
    if (userRole) detectedSignals.push(`Role: ${userRole}`);
    if (contractType) detectedSignals.push(`Contract: ${contractType}`);

    // Determine urgency
    let urgency: 'low' | 'medium' | 'high' = 'medium';
    if (contractMetadata?.expirationDate) {
      const expDate = new Date(contractMetadata.expirationDate);
      const daysToExpiration = (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToExpiration < 30) urgency = 'high';
      else if (daysToExpiration < 90) urgency = 'medium';
      else urgency = 'low';
    }

    logger.info({
      primaryGoal,
      secondaryGoals,
      confidence: confidence.toFixed(2),
      urgency,
    }, '🎯 User intent detected');

    return {
      primaryGoal,
      secondaryGoals,
      confidence,
      signals: detectedSignals,
      context: {
        contractType,
        urgency,
        userRole,
        deadline: contractMetadata?.expirationDate ? new Date(contractMetadata.expirationDate) : undefined,
      },
    };
  }

  /**
   * Generate goal-based execution plan
   */
  generateGoalPlan(intent: DetectedIntent, availableArtifacts: string[]): GoalBasedPlan {
    const { primaryGoal } = intent;

    const artifactPriorities = this.getArtifactPriorities(primaryGoal);
    const prioritizedArtifacts = availableArtifacts
      .map(type => ({
        type,
        priority: artifactPriorities[type] || 50,
        reasoning: this.getArtifactReasoning(type, primaryGoal),
      }))
      .sort((a, b) => b.priority - a.priority);

    // Skip low-value artifacts based on goal
    const skipArtifacts = prioritizedArtifacts
      .filter(a => a.priority < 30)
      .map(a => a.type);

    const optimizations = this.getOptimizations(intent);

    // Estimate value of plan
    const estimatedValue = this.calculatePlanValue(intent, prioritizedArtifacts);

    logger.info({
      primaryGoal,
      prioritizedCount: prioritizedArtifacts.length,
      skippedCount: skipArtifacts.length,
      estimatedValue: estimatedValue.toFixed(2),
    }, '📋 Goal-based plan generated');

    return {
      goal: primaryGoal,
      prioritizedArtifacts,
      skipArtifacts,
      optimizations,
      estimatedValue,
    };
  }

  /**
   * Get artifact priorities for specific goal
   */
  private getArtifactPriorities(goal: UserGoal): Record<string, number> {
    const priorities: Record<UserGoal, Record<string, number>> = {
      [UserGoal.NEGOTIATE]: {
        'NEGOTIATION_POINTS': 100,
        'FINANCIAL': 95,
        'PRICING_ANALYSIS': 90,
        'OVERVIEW': 80,
        'CLAUSES': 70,
        'RISK': 60,
        'OBLIGATIONS': 50,
        'COMPLIANCE': 40,
        'CONTACTS': 30,
        'AMENDMENTS': 20,
        'RENEWAL': 10,
      },
      [UserGoal.RISK_ASSESSMENT]: {
        'RISK': 100,
        'CLAUSES': 95,
        'OBLIGATIONS': 90,
        'COMPLIANCE': 85,
        'LIABILITY_ANALYSIS': 80,
        'INSURANCE_REVIEW': 75,
        'OVERVIEW': 70,
        'FINANCIAL': 60,
        'CONTACTS': 40,
        'NEGOTIATION_POINTS': 30,
        'RENEWAL': 20,
      },
      [UserGoal.COST_OPTIMIZATION]: {
        'FINANCIAL': 100,
        'PRICING_ANALYSIS': 95,
        'NEGOTIATION_POINTS': 90,
        'OBLIGATIONS': 80,
        'OVERVIEW': 75,
        'CLAUSES': 60,
        'RISK': 50,
        'CONTACTS': 40,
        'COMPLIANCE': 30,
        'RENEWAL': 20,
      },
      [UserGoal.COMPLIANCE_CHECK]: {
        'COMPLIANCE': 100,
        'REGULATORY_CHECK': 95,
        'CLAUSES': 90,
        'OBLIGATIONS': 85,
        'RISK': 80,
        'OVERVIEW': 70,
        'CONTACTS': 50,
        'FINANCIAL': 40,
        'NEGOTIATION_POINTS': 30,
        'RENEWAL': 20,
      },
      [UserGoal.RENEWAL_PREP]: {
        'RENEWAL': 100,
        'OBLIGATIONS': 95,
        'FINANCIAL': 90,
        'CLAUSES': 85,
        'CONTACTS': 80,
        'OVERVIEW': 75,
        'NEGOTIATION_POINTS': 70,
        'RISK': 60,
        'COMPLIANCE': 50,
        'AMENDMENTS': 40,
      },
      [UserGoal.QUICK_REVIEW]: {
        'OVERVIEW': 100,
        'FINANCIAL': 80,
        'CLAUSES': 70,
        'CONTACTS': 60,
        'RISK': 50,
        'OBLIGATIONS': 40,
        'COMPLIANCE': 30,
        'NEGOTIATION_POINTS': 20,
        'RENEWAL': 10,
      },
      [UserGoal.DEEP_ANALYSIS]: {
        'OVERVIEW': 100,
        'CLAUSES': 95,
        'OBLIGATIONS': 95,
        'FINANCIAL': 90,
        'RISK': 90,
        'COMPLIANCE': 90,
        'NEGOTIATION_POINTS': 85,
        'CONTACTS': 80,
        'RENEWAL': 80,
        'AMENDMENTS': 75,
      },
    };

    return priorities[goal] || {};
  }

  /**
   * Get reasoning for artifact priority
   */
  private getArtifactReasoning(artifactType: string, goal: UserGoal): string {
    const reasoning: Record<string, Record<UserGoal, string>> = {
      'NEGOTIATION_POINTS': {
        [UserGoal.NEGOTIATE]: 'Critical for identifying leverage points and negotiation strategies',
        [UserGoal.COST_OPTIMIZATION]: 'Helps identify cost reduction opportunities',
        [UserGoal.RISK_ASSESSMENT]: 'Low priority for risk assessment',
        [UserGoal.COMPLIANCE_CHECK]: 'Not relevant for compliance',
        [UserGoal.RENEWAL_PREP]: 'Important for renewal negotiations',
        [UserGoal.QUICK_REVIEW]: 'Skip for quick review',
        [UserGoal.DEEP_ANALYSIS]: 'Valuable for comprehensive analysis',
      },
      'FINANCIAL': {
        [UserGoal.NEGOTIATE]: 'Essential for understanding current costs and targets',
        [UserGoal.COST_OPTIMIZATION]: 'Primary focus for cost optimization',
        [UserGoal.RISK_ASSESSMENT]: 'Moderate importance for financial risk',
        [UserGoal.COMPLIANCE_CHECK]: 'Low priority for compliance',
        [UserGoal.RENEWAL_PREP]: 'Critical for renewal budgeting',
        [UserGoal.QUICK_REVIEW]: 'Important for quick overview',
        [UserGoal.DEEP_ANALYSIS]: 'Essential for complete analysis',
      },
      // Add more as needed
    };

    return reasoning[artifactType]?.[goal] || 'Standard artifact for contract analysis';
  }

  /**
   * Get optimizations for specific intent
   */
  private getOptimizations(intent: DetectedIntent): string[] {
    const optimizations: string[] = [];

    if (intent.context.urgency === 'high') {
      optimizations.push('Use parallel processing for all artifacts');
      optimizations.push('Skip low-priority artifacts');
      optimizations.push('Use faster models (GPT-3.5-turbo) for non-critical artifacts');
    }

    if (intent.primaryGoal === UserGoal.QUICK_REVIEW) {
      optimizations.push('Generate only top 3 artifacts');
      optimizations.push('Use summarization mode');
      optimizations.push('Skip detailed analysis');
    }

    if (intent.primaryGoal === UserGoal.DEEP_ANALYSIS) {
      optimizations.push('Use premium models (GPT-4o) for all artifacts');
      optimizations.push('Enable self-critique for quality');
      optimizations.push('Generate comprehensive cross-references');
    }

    return optimizations;
  }

  /**
   * Calculate estimated value of plan
   */
  private calculatePlanValue(intent: DetectedIntent, artifacts: GoalBasedPlan['prioritizedArtifacts']): number {
    const baseValue = artifacts.reduce((sum, a) => sum + a.priority, 0);
    const confidenceMultiplier = intent.confidence;
    const urgencyMultiplier = intent.context.urgency === 'high' ? 1.5 : intent.context.urgency === 'medium' ? 1.2 : 1.0;

    return baseValue * confidenceMultiplier * urgencyMultiplier;
  }
}

/**
 * Get singleton reasoner instance
 */
let reasonerInstance: GoalOrientedReasoner | null = null;

export function getGoalOrientedReasoner(): GoalOrientedReasoner {
  if (!reasonerInstance) {
    reasonerInstance = new GoalOrientedReasoner();
  }
  return reasonerInstance;
}
