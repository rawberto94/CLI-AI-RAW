/**
 * Contract Type Profiles
 * 
 * Defines contract-type-specific extraction rules, relevant artifacts,
 * mandatory/optional fields, and clause categories for adaptive AI extraction.
 */

// ============ CONTRACT TYPES ============

export type ContractType = 
  | 'NDA'
  | 'MSA'
  | 'SOW'
  | 'SLA'
  | 'EMPLOYMENT'
  | 'LEASE'
  | 'LICENSE'
  | 'PURCHASE'
  | 'PARTNERSHIP'
  | 'CONSULTING'
  | 'SUBSCRIPTION'
  | 'LOAN'
  | 'SETTLEMENT'
  | 'OTHER';

// ============ ARTIFACT RELEVANCE ============

export type ArtifactType = 
  | 'OVERVIEW'
  | 'CLAUSES'
  | 'FINANCIAL'
  | 'RISK'
  | 'COMPLIANCE'
  | 'OBLIGATIONS'
  | 'RENEWAL'
  | 'NEGOTIATION'
  | 'AMENDMENTS'
  | 'CONTACTS';

export type ArtifactRelevance = 'required' | 'optional' | 'not-applicable';

// ============ CONTRACT TYPE PROFILE ============

export interface ContractTypeProfile {
  /** Display name for the contract type */
  displayName: string;
  
  /** Description of what this contract type typically covers */
  description: string;
  
  /** Which artifacts are relevant and their relevance level */
  artifactRelevance: Record<ArtifactType, ArtifactRelevance>;
  
  /** Contract-type-specific clause categories to extract */
  clauseCategories: string[];
  
  /** Financial fields relevant for this contract type */
  financialFields: string[];
  
  /** Risk categories specific to this contract type */
  riskCategories: string[];
  
  /** Key terms/definitions to look for */
  keyTermsToExtract: string[];
  
  /** Extraction hints for the AI */
  extractionHints: string;
  
  /** Fields that must be present for valid extraction */
  mandatoryFields: string[];
  
  /** Expected document sections */
  expectedSections: string[];
}

// ============ CONTRACT TYPE PROFILES ============

export const CONTRACT_TYPE_PROFILES: Record<ContractType, ContractTypeProfile> = {
  NDA: {
    displayName: 'Non-Disclosure Agreement',
    description: 'Agreement to protect confidential information shared between parties',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'not-applicable',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'confidentiality_definition',
      'confidential_information_scope',
      'exclusions_from_confidentiality',
      'permitted_disclosure',
      'non_compete',
      'non_solicitation',
      'return_of_materials',
      'injunctive_relief',
      'term_and_survival',
      'governing_law',
    ],
    financialFields: [], // NDAs typically don't have financial terms
    riskCategories: [
      'IP_exposure',
      'broad_confidentiality_definition',
      'inadequate_exclusions',
      'unlimited_term',
      'one_sided_obligations',
      'missing_carve_outs',
    ],
    keyTermsToExtract: [
      'Confidential Information',
      'Disclosing Party',
      'Receiving Party',
      'Purpose',
      'Representatives',
      'Residual Knowledge',
    ],
    extractionHints: 'Focus on what constitutes confidential information, duration of obligations, and permitted uses. Financial terms are typically not present.',
    mandatoryFields: ['parties', 'effectiveDate', 'confidentialityDefinition', 'term'],
    expectedSections: ['Recitals', 'Definitions', 'Confidentiality Obligations', 'Exclusions', 'Term', 'Return of Materials'],
  },

  MSA: {
    displayName: 'Master Services Agreement',
    description: 'Framework agreement governing ongoing service relationship',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'scope_of_services',
      'payment_terms',
      'term_and_termination',
      'liability_limitation',
      'indemnification',
      'intellectual_property',
      'confidentiality',
      'warranty',
      'insurance',
      'force_majeure',
      'dispute_resolution',
      'change_order_process',
    ],
    financialFields: [
      'rate_cards',
      'payment_terms',
      'invoicing_requirements',
      'expense_reimbursement',
      'late_payment_fees',
      'price_escalation',
    ],
    riskCategories: [
      'unlimited_liability',
      'IP_ownership_ambiguity',
      'termination_for_convenience',
      'auto_renewal_trap',
      'broad_indemnification',
      'inadequate_insurance',
    ],
    keyTermsToExtract: [
      'Services',
      'Deliverables',
      'Statement of Work',
      'Change Order',
      'Acceptance Criteria',
      'Service Levels',
    ],
    extractionHints: 'Look for framework terms that apply to future SOWs. Rate cards, payment terms, and liability caps are critical. Check for auto-renewal and termination provisions.',
    mandatoryFields: ['parties', 'effectiveDate', 'scopeOfServices', 'paymentTerms', 'term', 'terminationRights'],
    expectedSections: ['Recitals', 'Services', 'Compensation', 'Term', 'Termination', 'IP Rights', 'Confidentiality', 'Liability', 'General Provisions'],
  },

  SOW: {
    displayName: 'Statement of Work',
    description: 'Specific project scope, deliverables, and pricing under an MSA',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'project_scope',
      'deliverables',
      'milestones',
      'acceptance_criteria',
      'timeline',
      'resources',
      'assumptions',
      'exclusions',
      'change_management',
    ],
    financialFields: [
      'fixed_price',
      'time_and_materials',
      'milestone_payments',
      'rate_cards',
      'expense_caps',
      'budget_breakdown',
      'payment_schedule',
    ],
    riskCategories: [
      'scope_creep',
      'unclear_deliverables',
      'unrealistic_timeline',
      'missing_acceptance_criteria',
      'hidden_assumptions',
      'resource_dependency',
    ],
    keyTermsToExtract: [
      'Deliverables',
      'Milestones',
      'Acceptance',
      'Project Manager',
      'Key Personnel',
      'Timeline',
      'Budget',
    ],
    extractionHints: 'Focus heavily on deliverables, timelines, and payment milestones. Extract rate cards and resource allocations. Identify assumptions and exclusions.',
    mandatoryFields: ['deliverables', 'timeline', 'pricing', 'milestones', 'resources'],
    expectedSections: ['Scope', 'Deliverables', 'Timeline', 'Pricing', 'Resources', 'Assumptions', 'Acceptance'],
  },

  SLA: {
    displayName: 'Service Level Agreement',
    description: 'Defines service standards, metrics, and remedies',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'service_levels',
      'uptime_commitments',
      'response_times',
      'resolution_times',
      'service_credits',
      'exclusions',
      'measurement_methodology',
      'reporting_requirements',
      'escalation_procedures',
    ],
    financialFields: [
      'service_credits',
      'credit_caps',
      'credit_calculation',
      'refund_terms',
    ],
    riskCategories: [
      'inadequate_SLA_metrics',
      'excessive_exclusions',
      'credit_caps_too_low',
      'measurement_manipulation',
      'unclear_escalation',
    ],
    keyTermsToExtract: [
      'Uptime',
      'Availability',
      'Response Time',
      'Resolution Time',
      'Service Credit',
      'Priority Level',
      'Escalation',
    ],
    extractionHints: 'Extract all service level metrics with their targets and measurement periods. Identify credit structures and caps. Look for exclusions that limit remedies.',
    mandatoryFields: ['serviceLevels', 'metrics', 'credits', 'measurementMethod'],
    expectedSections: ['Service Definitions', 'Service Levels', 'Measurement', 'Credits', 'Exclusions', 'Reporting', 'Escalation'],
  },

  EMPLOYMENT: {
    displayName: 'Employment Agreement',
    description: 'Agreement defining employment relationship, compensation, and terms',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'position_and_duties',
      'compensation',
      'benefits',
      'equity_stock_options',
      'bonus_structure',
      'termination',
      'severance',
      'non_compete',
      'non_solicitation',
      'confidentiality',
      'IP_assignment',
      'at_will_employment',
    ],
    financialFields: [
      'base_salary',
      'bonus_target',
      'equity_grants',
      'vesting_schedule',
      'benefits_value',
      'severance_terms',
      'expense_allowance',
      'signing_bonus',
      'relocation_allowance',
    ],
    riskCategories: [
      'broad_non_compete',
      'excessive_IP_assignment',
      'inadequate_severance',
      'unclear_bonus_criteria',
      'vesting_cliff',
      'change_of_control',
    ],
    keyTermsToExtract: [
      'Base Salary',
      'Target Bonus',
      'Equity',
      'Vesting',
      'Cliff',
      'Severance',
      'Non-Compete Period',
      'Notice Period',
    ],
    extractionHints: 'Focus on compensation structure (base, bonus, equity). Extract vesting schedules and severance terms. Identify restrictive covenants and their duration/scope.',
    mandatoryFields: ['position', 'startDate', 'baseSalary', 'benefits'],
    expectedSections: ['Position', 'Compensation', 'Benefits', 'Equity', 'Termination', 'Restrictive Covenants', 'Confidentiality'],
  },

  LEASE: {
    displayName: 'Lease Agreement',
    description: 'Agreement for rental of real property',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'premises_description',
      'lease_term',
      'rent_schedule',
      'security_deposit',
      'common_area_maintenance',
      'utilities',
      'maintenance_repairs',
      'alterations',
      'subletting_assignment',
      'default_remedies',
      'insurance_requirements',
      'surrender_condition',
    ],
    financialFields: [
      'base_rent',
      'rent_escalation',
      'security_deposit',
      'cam_charges',
      'property_taxes',
      'utilities_estimate',
      'tenant_improvement_allowance',
      'late_fees',
    ],
    riskCategories: [
      'excessive_rent_escalation',
      'triple_net_exposure',
      'unclear_CAM_calculations',
      'inadequate_TI_allowance',
      'personal_guarantee',
      'early_termination_costs',
    ],
    keyTermsToExtract: [
      'Premises',
      'Landlord',
      'Tenant',
      'Base Rent',
      'NNN',
      'CAM',
      'TI Allowance',
      'Security Deposit',
      'Renewal Option',
    ],
    extractionHints: 'Extract rent schedule with escalations. Identify all additional charges (CAM, taxes, insurance). Look for renewal options and termination rights.',
    mandatoryFields: ['premises', 'term', 'rent', 'securityDeposit', 'parties'],
    expectedSections: ['Premises', 'Term', 'Rent', 'Operating Expenses', 'Use', 'Maintenance', 'Insurance', 'Default'],
  },

  LICENSE: {
    displayName: 'License Agreement',
    description: 'Agreement granting rights to use IP, software, or other assets',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'license_grant',
      'license_scope',
      'license_restrictions',
      'exclusivity',
      'territory',
      'sublicensing',
      'IP_ownership',
      'warranty_of_title',
      'infringement_indemnity',
      'audit_rights',
    ],
    financialFields: [
      'license_fee',
      'royalty_rate',
      'minimum_royalty',
      'per_seat_pricing',
      'usage_tiers',
      'maintenance_fees',
    ],
    riskCategories: [
      'scope_ambiguity',
      'IP_infringement_exposure',
      'audit_rights_burden',
      'exclusive_lock_in',
      'termination_consequences',
    ],
    keyTermsToExtract: [
      'Licensed Material',
      'License Scope',
      'Permitted Use',
      'Royalty',
      'Territory',
      'Sublicense',
      'Derivative Works',
    ],
    extractionHints: 'Focus on license scope and restrictions. Extract pricing model (perpetual, subscription, per-seat, royalty). Identify IP ownership and infringement provisions.',
    mandatoryFields: ['licensedMaterial', 'licenseScope', 'licenseFee', 'term'],
    expectedSections: ['Grant', 'Scope', 'Restrictions', 'Fees', 'IP Rights', 'Warranty', 'Termination'],
  },

  PURCHASE: {
    displayName: 'Purchase Agreement',
    description: 'Agreement for sale of goods or assets',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'goods_description',
      'purchase_price',
      'payment_terms',
      'delivery_terms',
      'inspection_acceptance',
      'warranty',
      'title_transfer',
      'risk_of_loss',
      'returns_exchanges',
      'limitation_of_liability',
    ],
    financialFields: [
      'purchase_price',
      'deposit',
      'payment_schedule',
      'taxes',
      'shipping_costs',
      'installation_costs',
    ],
    riskCategories: [
      'unclear_specifications',
      'inadequate_warranty',
      'title_defects',
      'delivery_delays',
      'acceptance_criteria',
    ],
    keyTermsToExtract: [
      'Goods',
      'Purchase Price',
      'Delivery Date',
      'Acceptance Period',
      'Warranty Period',
      'FOB',
      'Incoterms',
    ],
    extractionHints: 'Extract goods specifications, pricing, and delivery terms. Look for Incoterms or FOB terms. Identify warranty duration and scope.',
    mandatoryFields: ['goods', 'price', 'deliveryTerms', 'warranty'],
    expectedSections: ['Goods', 'Price', 'Payment', 'Delivery', 'Acceptance', 'Warranty', 'Risk of Loss'],
  },

  PARTNERSHIP: {
    displayName: 'Partnership Agreement',
    description: 'Agreement forming and governing a business partnership',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'partnership_purpose',
      'capital_contributions',
      'profit_loss_allocation',
      'management_voting',
      'partner_duties',
      'distributions',
      'admission_of_partners',
      'withdrawal_buyout',
      'dissolution',
      'non_compete',
    ],
    financialFields: [
      'capital_contributions',
      'profit_sharing_ratio',
      'loss_allocation',
      'distribution_frequency',
      'buyout_formula',
      'capital_call_provisions',
    ],
    riskCategories: [
      'unlimited_liability',
      'deadlock_provisions',
      'unfair_buyout_terms',
      'capital_call_exposure',
      'fiduciary_duties',
    ],
    keyTermsToExtract: [
      'Partner',
      'Capital Contribution',
      'Profit Share',
      'Managing Partner',
      'Buyout',
      'Dissolution',
      'Draw',
    ],
    extractionHints: 'Focus on capital contributions, profit/loss allocation, and management rights. Extract buyout provisions and dissolution triggers.',
    mandatoryFields: ['partners', 'capitalContributions', 'profitSharing', 'management'],
    expectedSections: ['Formation', 'Capital', 'Profits/Losses', 'Management', 'Partners Rights', 'Withdrawal', 'Dissolution'],
  },

  CONSULTING: {
    displayName: 'Consulting Agreement',
    description: 'Agreement for professional consulting services',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'scope_of_services',
      'deliverables',
      'compensation',
      'expenses',
      'independent_contractor',
      'confidentiality',
      'IP_ownership',
      'termination',
      'non_compete',
      'insurance',
    ],
    financialFields: [
      'hourly_rate',
      'daily_rate',
      'fixed_fee',
      'retainer',
      'expense_reimbursement',
      'invoicing_terms',
      'payment_terms',
    ],
    riskCategories: [
      'scope_creep',
      'IP_ownership_ambiguity',
      'misclassification_risk',
      'inadequate_insurance',
    ],
    keyTermsToExtract: [
      'Consultant',
      'Services',
      'Rate',
      'Deliverables',
      'Work Product',
      'Independent Contractor',
    ],
    extractionHints: 'Extract rate structure and payment terms. Verify independent contractor classification. Identify IP ownership and confidentiality provisions.',
    mandatoryFields: ['services', 'compensation', 'term', 'independentContractorStatus'],
    expectedSections: ['Services', 'Compensation', 'Term', 'IP Rights', 'Confidentiality', 'Independent Contractor', 'Termination'],
  },

  SUBSCRIPTION: {
    displayName: 'Subscription Agreement',
    description: 'Agreement for recurring subscription services (SaaS, etc.)',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'subscription_scope',
      'service_levels',
      'data_privacy',
      'data_ownership',
      'usage_limits',
      'overage_charges',
      'auto_renewal',
      'price_increases',
      'termination_rights',
      'data_portability',
    ],
    financialFields: [
      'subscription_fee',
      'billing_frequency',
      'usage_tiers',
      'overage_rates',
      'price_escalation',
      'setup_fees',
      'early_termination_fee',
    ],
    riskCategories: [
      'auto_renewal_trap',
      'price_increase_exposure',
      'data_lock_in',
      'SLA_inadequacy',
      'termination_restrictions',
    ],
    keyTermsToExtract: [
      'Subscription',
      'Users',
      'Seats',
      'Tier',
      'Auto-Renewal',
      'Data Export',
      'Usage',
    ],
    extractionHints: 'Extract pricing tiers and usage limits. Identify auto-renewal terms and price increase caps. Look for data portability and termination provisions.',
    mandatoryFields: ['subscriptionScope', 'pricing', 'term', 'autoRenewal', 'dataRights'],
    expectedSections: ['Subscription', 'Fees', 'Usage', 'Service Levels', 'Data', 'Term', 'Termination'],
  },

  LOAN: {
    displayName: 'Loan Agreement',
    description: 'Agreement for lending of money with repayment terms',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'principal_amount',
      'interest_rate',
      'repayment_schedule',
      'collateral',
      'covenants',
      'events_of_default',
      'remedies',
      'prepayment',
      'representations',
      'conditions_precedent',
    ],
    financialFields: [
      'principal_amount',
      'interest_rate',
      'payment_schedule',
      'maturity_date',
      'prepayment_penalty',
      'late_fees',
      'origination_fee',
    ],
    riskCategories: [
      'high_interest_rate',
      'restrictive_covenants',
      'cross_default',
      'prepayment_restrictions',
      'collateral_exposure',
    ],
    keyTermsToExtract: [
      'Principal',
      'Interest Rate',
      'APR',
      'Maturity Date',
      'Collateral',
      'Covenant',
      'Default',
      'Acceleration',
    ],
    extractionHints: 'Extract principal, interest rate (fixed/variable), and repayment schedule. Identify covenants and events of default. Look for prepayment terms.',
    mandatoryFields: ['principal', 'interestRate', 'repaymentSchedule', 'maturityDate'],
    expectedSections: ['Loan Terms', 'Interest', 'Repayment', 'Security', 'Covenants', 'Default', 'Remedies'],
  },

  SETTLEMENT: {
    displayName: 'Settlement Agreement',
    description: 'Agreement resolving a dispute between parties',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION: 'not-applicable',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'recitals_background',
      'settlement_amount',
      'payment_terms',
      'release_of_claims',
      'no_admission',
      'confidentiality',
      'non_disparagement',
      'cooperation',
      'return_of_property',
      'dismissal_with_prejudice',
    ],
    financialFields: [
      'settlement_amount',
      'payment_schedule',
      'attorneys_fees',
      'structured_settlement',
    ],
    riskCategories: [
      'inadequate_release',
      'future_claims_exposure',
      'confidentiality_breach',
      'enforcement_difficulty',
    ],
    keyTermsToExtract: [
      'Settlement Amount',
      'Release',
      'Released Parties',
      'Claims',
      'Effective Date',
      'Dismissal',
    ],
    extractionHints: 'Extract settlement amount and payment terms. Focus on scope of release. Identify any retained claims or carve-outs.',
    mandatoryFields: ['settlementAmount', 'releaseScope', 'parties'],
    expectedSections: ['Recitals', 'Settlement Payment', 'Release', 'Confidentiality', 'Non-Disparagement', 'Dismissal'],
  },

  OTHER: {
    displayName: 'Other Contract',
    description: 'Contract type not matching standard categories',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'purpose',
      'scope',
      'obligations',
      'payment',
      'term',
      'termination',
      'liability',
      'confidentiality',
      'dispute_resolution',
      'general_provisions',
    ],
    financialFields: [
      'total_value',
      'payment_terms',
      'payment_schedule',
    ],
    riskCategories: [
      'unclear_obligations',
      'liability_exposure',
      'termination_rights',
      'ambiguous_terms',
    ],
    keyTermsToExtract: [],
    extractionHints: 'Apply general contract analysis. Extract key terms, parties, dates, and financial terms if present.',
    mandatoryFields: ['parties', 'effectiveDate'],
    expectedSections: [],
  },
};

// ============ DETECTION KEYWORDS ============

export const CONTRACT_TYPE_KEYWORDS: Record<ContractType, string[]> = {
  NDA: ['non-disclosure', 'nda', 'confidentiality agreement', 'confidential information', 'disclosing party', 'receiving party'],
  MSA: ['master services agreement', 'msa', 'master agreement', 'framework agreement', 'statement of work'],
  SOW: ['statement of work', 'sow', 'work order', 'project scope', 'deliverables', 'milestones'],
  SLA: ['service level agreement', 'sla', 'uptime', 'availability', 'service credits', 'response time'],
  EMPLOYMENT: ['employment agreement', 'employment contract', 'offer letter', 'at-will employment', 'employee', 'employer', 'salary', 'benefits'],
  LEASE: ['lease agreement', 'rental agreement', 'landlord', 'tenant', 'premises', 'rent', 'security deposit', 'cam'],
  LICENSE: ['license agreement', 'software license', 'license grant', 'licensee', 'licensor', 'royalty', 'intellectual property'],
  PURCHASE: ['purchase agreement', 'sale agreement', 'buyer', 'seller', 'goods', 'purchase price', 'delivery terms'],
  PARTNERSHIP: ['partnership agreement', 'joint venture', 'partners', 'capital contribution', 'profit sharing', 'general partner'],
  CONSULTING: ['consulting agreement', 'consultant', 'professional services', 'independent contractor', 'advisory'],
  SUBSCRIPTION: ['subscription agreement', 'saas', 'subscription', 'monthly fee', 'annual fee', 'auto-renewal', 'seats', 'users'],
  LOAN: ['loan agreement', 'promissory note', 'principal', 'interest rate', 'borrower', 'lender', 'collateral', 'maturity'],
  SETTLEMENT: ['settlement agreement', 'release', 'release of claims', 'settlement amount', 'dismissal', 'without prejudice'],
  OTHER: [],
};

// ============ HELPER FUNCTIONS ============

/**
 * Detect contract type from extracted text
 */
export function detectContractType(text: string): { type: ContractType; confidence: number; matchedKeywords: string[] } {
  const lowercaseText = text.toLowerCase();
  const scores: { type: ContractType; score: number; matchedKeywords: string[] }[] = [];

  for (const [type, keywords] of Object.entries(CONTRACT_TYPE_KEYWORDS) as [ContractType, string[]][]) {
    if (type === 'OTHER') continue;
    
    const matchedKeywords = keywords.filter(keyword => lowercaseText.includes(keyword.toLowerCase()));
    const score = matchedKeywords.length / keywords.length;
    
    if (matchedKeywords.length > 0) {
      scores.push({ type, score, matchedKeywords });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0 || scores[0].score < 0.1) {
    return { type: 'OTHER', confidence: 0.5, matchedKeywords: [] };
  }

  return {
    type: scores[0].type,
    confidence: Math.min(0.95, scores[0].score + 0.3), // Boost confidence but cap at 95%
    matchedKeywords: scores[0].matchedKeywords,
  };
}

/**
 * Get extraction profile for a contract type
 */
export function getContractProfile(type: ContractType): ContractTypeProfile {
  return CONTRACT_TYPE_PROFILES[type] || CONTRACT_TYPE_PROFILES.OTHER;
}

/**
 * Get relevant artifacts for a contract type
 */
export function getRelevantArtifacts(type: ContractType): ArtifactType[] {
  const profile = getContractProfile(type);
  return (Object.entries(profile.artifactRelevance) as [ArtifactType, ArtifactRelevance][])
    .filter(([_, relevance]) => relevance !== 'not-applicable')
    .map(([artifact]) => artifact);
}

/**
 * Check if an artifact is applicable for a contract type
 */
export function isArtifactApplicable(type: ContractType, artifact: ArtifactType): boolean {
  const profile = getContractProfile(type);
  return profile.artifactRelevance[artifact] !== 'not-applicable';
}

/**
 * Get enhanced extraction prompt for contract type
 */
export function getEnhancedPromptHints(type: ContractType): string {
  const profile = getContractProfile(type);
  return `
Contract Type: ${profile.displayName}
${profile.extractionHints}

Key terms to look for: ${profile.keyTermsToExtract.join(', ')}
Expected sections: ${profile.expectedSections.join(', ')}
Clause categories to focus on: ${profile.clauseCategories.slice(0, 5).join(', ')}
`;
}

/**
 * Get tab priority order for a contract type
 * Returns artifact types sorted by relevance (required first, then optional)
 */
export function getTabPriorityOrder(type: ContractType): ArtifactType[] {
  const profile = getContractProfile(type);
  const required: ArtifactType[] = [];
  const optional: ArtifactType[] = [];
  
  for (const [artifact, relevance] of Object.entries(profile.artifactRelevance) as [ArtifactType, ArtifactRelevance][]) {
    if (relevance === 'required') {
      required.push(artifact);
    } else if (relevance === 'optional') {
      optional.push(artifact);
    }
  }
  
  return [...required, ...optional];
}

/**
 * Get missing mandatory fields for a contract
 */
export function getMissingMandatoryFields(
  type: ContractType, 
  extractedData: Record<string, any>
): { field: string; importance: 'critical' | 'important' | 'recommended' }[] {
  const profile = getContractProfile(type);
  const missing: { field: string; importance: 'critical' | 'important' | 'recommended' }[] = [];
  
  for (const field of profile.mandatoryFields) {
    const normalizedField = field.toLowerCase().replace(/[_\s]/g, '');
    let found = false;
    
    // Deep search for the field in extracted data
    const searchInObject = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') return false;
      
      for (const [key, value] of Object.entries(obj)) {
        const normalizedKey = key.toLowerCase().replace(/[_\s]/g, '');
        if (normalizedKey.includes(normalizedField) || normalizedField.includes(normalizedKey)) {
          if (value !== null && value !== undefined && value !== '') {
            return true;
          }
        }
        if (typeof value === 'object' && searchInObject(value)) {
          return true;
        }
      }
      return false;
    };
    
    found = searchInObject(extractedData);
    
    if (!found) {
      // Determine importance based on field type
      const criticalFields = ['parties', 'effective_date', 'term', 'value', 'confidential_information'];
      const importantFields = ['termination', 'governing_law', 'jurisdiction', 'notice'];
      
      let importance: 'critical' | 'important' | 'recommended' = 'recommended';
      if (criticalFields.some(f => normalizedField.includes(f.replace(/_/g, '')))) {
        importance = 'critical';
      } else if (importantFields.some(f => normalizedField.includes(f.replace(/_/g, '')))) {
        importance = 'important';
      }
      
      missing.push({ field, importance });
    }
  }
  
  return missing;
}

/**
 * Get smart suggestions based on contract type and extracted data
 */
export function getSmartSuggestions(
  type: ContractType,
  extractedData: Record<string, any>
): { category: string; suggestion: string; priority: 'high' | 'medium' | 'low' }[] {
  const profile = getContractProfile(type);
  const suggestions: { category: string; suggestion: string; priority: 'high' | 'medium' | 'low' }[] = [];
  
  // Check for missing clauses
  const missingFields = getMissingMandatoryFields(type, extractedData);
  for (const { field, importance } of missingFields) {
    suggestions.push({
      category: 'Missing Field',
      suggestion: `Consider adding "${field.replace(/_/g, ' ')}" - this is typically ${importance} for ${profile.displayName} contracts.`,
      priority: importance === 'critical' ? 'high' : importance === 'important' ? 'medium' : 'low'
    });
  }
  
  // Type-specific suggestions
  switch (type) {
    case 'NDA':
      if (!extractedData.clauses?.some((c: any) => c.title?.toLowerCase().includes('return'))) {
        suggestions.push({
          category: 'Best Practice',
          suggestion: 'Consider including a clause for return/destruction of confidential information upon termination.',
          priority: 'medium'
        });
      }
      break;
      
    case 'EMPLOYMENT':
      if (!extractedData.financial?.benefits) {
        suggestions.push({
          category: 'Completeness',
          suggestion: 'No benefits information found. Consider documenting health insurance, retirement plans, and other benefits.',
          priority: 'medium'
        });
      }
      break;
      
    case 'MSA':
      if (!extractedData.clauses?.some((c: any) => c.title?.toLowerCase().includes('sow') || c.title?.toLowerCase().includes('statement of work'))) {
        suggestions.push({
          category: 'Structure',
          suggestion: 'MSAs typically reference Statements of Work. Ensure SOW template/process is defined.',
          priority: 'medium'
        });
      }
      break;
      
    case 'LEASE':
      if (!extractedData.financial?.securityDeposit) {
        suggestions.push({
          category: 'Financial',
          suggestion: 'No security deposit terms found. This is typically required for lease agreements.',
          priority: 'high'
        });
      }
      break;
      
    case 'SLA':
      if (!extractedData.clauses?.some((c: any) => c.title?.toLowerCase().includes('uptime') || c.title?.toLowerCase().includes('availability'))) {
        suggestions.push({
          category: 'Service Levels',
          suggestion: 'Consider defining specific uptime/availability targets with measurement criteria.',
          priority: 'high'
        });
      }
      break;
  }
  
  // Risk-based suggestions
  if (extractedData.risk?.riskScore > 70) {
    suggestions.push({
      category: 'Risk Review',
      suggestion: 'High risk score detected. Legal review recommended before signing.',
      priority: 'high'
    });
  }
  
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Get contract type comparison insights
 */
export function getContractTypeInsights(type: ContractType): {
  typicalDuration: string;
  commonIssues: string[];
  negotiationFocus: string[];
  industryBenchmarks: { metric: string; typical: string }[];
} {
  const insights: Record<ContractType, ReturnType<typeof getContractTypeInsights>> = {
    NDA: {
      typicalDuration: '1-5 years',
      commonIssues: ['Overly broad confidentiality definitions', 'Indefinite obligations', 'One-sided provisions'],
      negotiationFocus: ['Duration of obligations', 'Definition scope', 'Permitted disclosures'],
      industryBenchmarks: [
        { metric: 'Typical Duration', typical: '2-3 years' },
        { metric: 'Survival Period', typical: '3-5 years post-termination' }
      ]
    },
    MSA: {
      typicalDuration: '2-5 years with renewals',
      commonIssues: ['Unclear scope changes process', 'One-sided indemnification', 'IP ownership ambiguity'],
      negotiationFocus: ['Liability caps', 'IP rights', 'Change order process', 'Termination rights'],
      industryBenchmarks: [
        { metric: 'Liability Cap', typical: '1-2x annual contract value' },
        { metric: 'Payment Terms', typical: 'Net 30-45 days' }
      ]
    },
    SOW: {
      typicalDuration: 'Project-based (3-18 months)',
      commonIssues: ['Scope creep provisions', 'Milestone ambiguity', 'Acceptance criteria gaps'],
      negotiationFocus: ['Deliverable definitions', 'Timeline flexibility', 'Change management'],
      industryBenchmarks: [
        { metric: 'Buffer Time', typical: '10-15% of estimated duration' },
        { metric: 'Payment Milestones', typical: '3-5 milestone payments' }
      ]
    },
    SLA: {
      typicalDuration: '1-3 years',
      commonIssues: ['Unrealistic uptime targets', 'Vague penalty calculations', 'Exclusion abuse'],
      negotiationFocus: ['Uptime definitions', 'Credit calculations', 'Exclusion windows'],
      industryBenchmarks: [
        { metric: 'Uptime Target', typical: '99.5-99.99%' },
        { metric: 'Max Credit', typical: '30% of monthly fee' }
      ]
    },
    EMPLOYMENT: {
      typicalDuration: 'At-will or fixed term',
      commonIssues: ['Overly broad non-competes', 'IP assignment scope', 'Termination ambiguity'],
      negotiationFocus: ['Compensation structure', 'Non-compete geography', 'IP boundaries'],
      industryBenchmarks: [
        { metric: 'Notice Period', typical: '2-4 weeks' },
        { metric: 'Non-Compete Duration', typical: '6-12 months' }
      ]
    },
    LEASE: {
      typicalDuration: '1-10 years',
      commonIssues: ['Hidden fees', 'Maintenance ambiguity', 'Sublease restrictions'],
      negotiationFocus: ['Rent escalation', 'CAM charges', 'Early termination', 'Renewal options'],
      industryBenchmarks: [
        { metric: 'Security Deposit', typical: '1-3 months rent' },
        { metric: 'Annual Escalation', typical: '2-4%' }
      ]
    },
    LICENSE: {
      typicalDuration: '1-5 years',
      commonIssues: ['Usage restrictions', 'Audit rights overreach', 'Termination data access'],
      negotiationFocus: ['Scope of use', 'User definitions', 'Data ownership'],
      industryBenchmarks: [
        { metric: 'Price Increase Cap', typical: '3-5% annually' },
        { metric: 'Audit Frequency', typical: 'Once per year' }
      ]
    },
    PURCHASE: {
      typicalDuration: 'Transaction-based',
      commonIssues: ['Delivery terms ambiguity', 'Warranty limitations', 'Return policy gaps'],
      negotiationFocus: ['Payment terms', 'Delivery schedule', 'Quality standards'],
      industryBenchmarks: [
        { metric: 'Payment Terms', typical: 'Net 30-60' },
        { metric: 'Warranty Period', typical: '1-2 years' }
      ]
    },
    PARTNERSHIP: {
      typicalDuration: '3-10 years',
      commonIssues: ['Profit sharing clarity', 'Decision-making deadlocks', 'Exit mechanisms'],
      negotiationFocus: ['Governance structure', 'Capital contributions', 'Exit rights'],
      industryBenchmarks: [
        { metric: 'Decision Threshold', typical: '51-75% majority' },
        { metric: 'Buyout Period', typical: '90-180 days' }
      ]
    },
    CONSULTING: {
      typicalDuration: '3-12 months',
      commonIssues: ['Scope boundaries', 'Rate card ambiguity', 'Deliverable ownership'],
      negotiationFocus: ['Hourly vs fixed pricing', 'Expense policies', 'IP assignment'],
      industryBenchmarks: [
        { metric: 'Payment Terms', typical: 'Net 15-30' },
        { metric: 'Out-of-pocket Cap', typical: '10-15% of fees' }
      ]
    },
    SUBSCRIPTION: {
      typicalDuration: '1-3 years',
      commonIssues: ['Auto-renewal traps', 'Price increase limits', 'Downgrade restrictions'],
      negotiationFocus: ['Renewal terms', 'Price protection', 'Exit flexibility'],
      industryBenchmarks: [
        { metric: 'Auto-renewal Notice', typical: '30-90 days' },
        { metric: 'Price Increase Cap', typical: '5-7% annually' }
      ]
    },
    LOAN: {
      typicalDuration: '1-30 years',
      commonIssues: ['Hidden fees', 'Prepayment penalties', 'Default definitions'],
      negotiationFocus: ['Interest rate', 'Prepayment terms', 'Covenant flexibility'],
      industryBenchmarks: [
        { metric: 'Prepayment Penalty', typical: '1-3% declining' },
        { metric: 'Grace Period', typical: '10-15 days' }
      ]
    },
    SETTLEMENT: {
      typicalDuration: 'One-time',
      commonIssues: ['Release scope', 'Non-disparagement overreach', 'Confidentiality enforcement'],
      negotiationFocus: ['Release language', 'Payment timing', 'Non-admission clauses'],
      industryBenchmarks: [
        { metric: 'Payment Timing', typical: 'Within 30 days of signing' },
        { metric: 'Cooperation Period', typical: '1-2 years' }
      ]
    },
    OTHER: {
      typicalDuration: 'Varies',
      commonIssues: ['Unclear terms', 'Missing standard protections'],
      negotiationFocus: ['Core obligations', 'Term and termination', 'Liability'],
      industryBenchmarks: []
    }
  };
  
  return insights[type] || insights.OTHER;
}
