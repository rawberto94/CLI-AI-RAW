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
  | 'FRANCHISE'
  | 'DISTRIBUTION'
  | 'AGENCY'
  | 'JOINT_VENTURE'
  | 'MAINTENANCE'
  | 'WARRANTY'
  | 'INSURANCE'
  | 'MERGER_ACQUISITION'
  | 'INVESTMENT'
  | 'ROYALTY'
  | 'VARIATION'
  | 'ENGAGEMENT_LETTER'
  | 'AMENDMENT'
  | 'ADDENDUM'
  | 'MEMORANDUM_OF_UNDERSTANDING'
  | 'LETTER_OF_INTENT'
  | 'SUPPLY'
  | 'MANUFACTURING'
  | 'RESELLER'
  | 'SPONSORSHIP'
  | 'SERVICES'
  | 'CONSTRUCTION'
  | 'REAL_ESTATE'
  | 'SHAREHOLDERS'
  | 'OPERATING'
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
  | 'NEGOTIATION_POINTS'
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'required',
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
      NEGOTIATION_POINTS: 'not-applicable',
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

  FRANCHISE: {
    displayName: 'Franchise Agreement',
    description: 'Agreement granting rights to operate a franchise business',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'grant_of_franchise',
      'territory',
      'fees_royalties',
      'operations',
      'advertising',
      'training',
      'quality_standards',
      'term_renewal',
      'transfer_restrictions',
      'termination',
      'post_termination',
    ],
    financialFields: [
      'initial_franchise_fee',
      'royalty_rate',
      'advertising_fee',
      'equipment_costs',
      'training_fees',
      'renewal_fees',
    ],
    riskCategories: [
      'territory_encroachment',
      'excessive_royalties',
      'operational_restrictions',
      'transfer_limitations',
      'termination_exposure',
      'non_compete_scope',
    ],
    keyTermsToExtract: [
      'Franchise Fee',
      'Royalty',
      'Territory',
      'Franchisee',
      'Franchisor',
      'System',
      'Marks',
    ],
    extractionHints: 'Extract franchise fees, royalty percentages, territory definitions, and operational requirements. Focus on renewal and transfer rights.',
    mandatoryFields: ['franchiseFee', 'royaltyRate', 'territory', 'term'],
    expectedSections: ['Grant', 'Territory', 'Fees', 'Training', 'Operations', 'Advertising', 'Termination', 'Renewal'],
  },

  DISTRIBUTION: {
    displayName: 'Distribution Agreement',
    description: 'Agreement for product distribution rights and obligations',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'appointment',
      'territory',
      'products',
      'pricing',
      'minimum_purchase',
      'exclusivity',
      'marketing',
      'inventory',
      'warranty',
      'termination',
    ],
    financialFields: [
      'minimum_purchase_commitment',
      'discount_structure',
      'payment_terms',
      'marketing_contribution',
      'rebates',
    ],
    riskCategories: [
      'minimum_purchase_risk',
      'territory_restrictions',
      'price_control',
      'exclusivity_obligations',
      'inventory_liability',
    ],
    keyTermsToExtract: [
      'Products',
      'Territory',
      'Minimum Purchase',
      'Distributor',
      'Principal',
      'Exclusive',
    ],
    extractionHints: 'Extract territory, product scope, minimum commitments, and pricing terms. Focus on exclusivity and termination provisions.',
    mandatoryFields: ['products', 'territory', 'term', 'parties'],
    expectedSections: ['Appointment', 'Territory', 'Products', 'Pricing', 'Orders', 'Marketing', 'Term', 'Termination'],
  },

  AGENCY: {
    displayName: 'Agency Agreement',
    description: 'Agreement establishing an agency relationship for sales or representation',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'appointment',
      'authority',
      'territory',
      'commission',
      'duties',
      'reporting',
      'exclusivity',
      'non_compete',
      'termination',
      'indemnification',
    ],
    financialFields: [
      'commission_rate',
      'commission_structure',
      'advance_payments',
      'expense_reimbursement',
    ],
    riskCategories: [
      'authority_scope',
      'commission_disputes',
      'liability_exposure',
      'termination_compensation',
      'competitive_restrictions',
    ],
    keyTermsToExtract: [
      'Agent',
      'Principal',
      'Commission',
      'Authority',
      'Territory',
    ],
    extractionHints: 'Extract commission structure, territory, and scope of authority. Focus on what actions agent can take on behalf of principal.',
    mandatoryFields: ['commissionRate', 'territory', 'authorityScope'],
    expectedSections: ['Appointment', 'Authority', 'Commission', 'Duties', 'Term', 'Termination'],
  },

  JOINT_VENTURE: {
    displayName: 'Joint Venture Agreement',
    description: 'Agreement establishing a joint business venture between parties',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'purpose',
      'contributions',
      'ownership',
      'governance',
      'profit_sharing',
      'decision_making',
      'confidentiality',
      'exit_mechanisms',
      'deadlock_resolution',
      'non_compete',
    ],
    financialFields: [
      'capital_contributions',
      'profit_split',
      'loss_allocation',
      'funding_requirements',
      'distribution_policy',
    ],
    riskCategories: [
      'governance_deadlock',
      'exit_limitations',
      'fiduciary_duties',
      'contribution_disputes',
      'competitive_conflicts',
    ],
    keyTermsToExtract: [
      'Venture',
      'Contributions',
      'Profit Share',
      'Governance',
      'Exit',
      'Deadlock',
    ],
    extractionHints: 'Extract ownership percentages, contribution obligations, governance structure, and exit mechanisms. Focus on decision-making thresholds.',
    mandatoryFields: ['ownershipSplit', 'capitalContributions', 'governanceStructure'],
    expectedSections: ['Purpose', 'Contributions', 'Ownership', 'Governance', 'Profit Sharing', 'Exit', 'Dissolution'],
  },

  MAINTENANCE: {
    displayName: 'Maintenance Agreement',
    description: 'Agreement for ongoing maintenance and support services',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'scope_of_services',
      'response_times',
      'coverage_hours',
      'parts_labor',
      'preventive_maintenance',
      'emergency_services',
      'exclusions',
      'fees',
      'term_renewal',
    ],
    financialFields: [
      'monthly_fee',
      'annual_fee',
      'parts_costs',
      'labor_rates',
      'emergency_rates',
    ],
    riskCategories: [
      'service_gaps',
      'response_time_failures',
      'exclusion_scope',
      'liability_limitations',
      'price_escalation',
    ],
    keyTermsToExtract: [
      'Covered Equipment',
      'Response Time',
      'Service Hours',
      'Parts',
      'Labor',
    ],
    extractionHints: 'Extract covered items, response time commitments, and fee structure. Focus on exclusions and what triggers additional charges.',
    mandatoryFields: ['coveredEquipment', 'responseTime', 'fees'],
    expectedSections: ['Scope', 'Response Times', 'Coverage', 'Fees', 'Exclusions', 'Term'],
  },

  WARRANTY: {
    displayName: 'Warranty Agreement',
    description: 'Agreement defining warranty terms and coverage',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'warranty_scope',
      'warranty_period',
      'covered_defects',
      'exclusions',
      'remedy',
      'claims_process',
      'limitations',
      'disclaimers',
    ],
    financialFields: [
      'warranty_fee',
      'deductibles',
      'maximum_coverage',
    ],
    riskCategories: [
      'narrow_coverage',
      'broad_exclusions',
      'remedy_limitations',
      'claims_procedures',
      'disclaimer_scope',
    ],
    keyTermsToExtract: [
      'Warranty Period',
      'Defects',
      'Covered',
      'Excluded',
      'Remedy',
      'Claims',
    ],
    extractionHints: 'Extract warranty period, coverage scope, and remedies. Focus on exclusions and limitations that reduce actual coverage.',
    mandatoryFields: ['warrantyPeriod', 'coverageScope', 'remedies'],
    expectedSections: ['Coverage', 'Period', 'Exclusions', 'Claims', 'Remedies', 'Limitations'],
  },

  INSURANCE: {
    displayName: 'Insurance Policy/Agreement',
    description: 'Insurance policy or related agreement',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'coverage',
      'exclusions',
      'deductibles',
      'limits',
      'premiums',
      'claims_process',
      'duties_after_loss',
      'cancellation',
      'subrogation',
    ],
    financialFields: [
      'premium',
      'deductible',
      'coverage_limit',
      'aggregate_limit',
      'per_occurrence_limit',
    ],
    riskCategories: [
      'coverage_gaps',
      'exclusion_exposure',
      'limits_inadequacy',
      'claims_process_complexity',
      'cancellation_risk',
    ],
    keyTermsToExtract: [
      'Insured',
      'Insurer',
      'Premium',
      'Deductible',
      'Coverage',
      'Limit',
      'Exclusion',
    ],
    extractionHints: 'Extract coverage limits, deductibles, premiums, and exclusions. Focus on conditions that could void coverage.',
    mandatoryFields: ['coverageLimits', 'premium', 'deductible', 'exclusions'],
    expectedSections: ['Declarations', 'Coverage', 'Exclusions', 'Conditions', 'Definitions'],
  },

  MERGER_ACQUISITION: {
    displayName: 'Merger/Acquisition Agreement',
    description: 'Agreement for merger, acquisition, or sale of business/assets',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'purchase_price',
      'representations_warranties',
      'covenants',
      'conditions_precedent',
      'indemnification',
      'closing',
      'escrow',
      'non_compete',
      'employee_matters',
      'regulatory_approvals',
    ],
    financialFields: [
      'purchase_price',
      'earnout',
      'escrow_amount',
      'working_capital_adjustment',
      'debt_assumption',
    ],
    riskCategories: [
      'rep_warranty_exposure',
      'indemnification_limits',
      'earnout_disputes',
      'regulatory_risk',
      'integration_risk',
      'employee_retention',
    ],
    keyTermsToExtract: [
      'Purchase Price',
      'Closing',
      'Earnout',
      'Escrow',
      'Indemnification',
      'Representations',
      'Warranties',
      'Material Adverse Effect',
    ],
    extractionHints: 'Extract purchase price, closing conditions, and indemnification caps. Focus on representations/warranties survival periods and limitations.',
    mandatoryFields: ['purchasePrice', 'closingConditions', 'indemnificationCap'],
    expectedSections: ['Recitals', 'Purchase Price', 'Representations', 'Covenants', 'Conditions', 'Indemnification', 'Closing'],
  },

  INVESTMENT: {
    displayName: 'Investment Agreement',
    description: 'Agreement for equity investment, convertible notes, or funding',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'investment_amount',
      'valuation',
      'equity_terms',
      'board_rights',
      'protective_provisions',
      'anti_dilution',
      'liquidation_preference',
      'information_rights',
      'drag_along',
      'tag_along',
    ],
    financialFields: [
      'investment_amount',
      'valuation',
      'price_per_share',
      'liquidation_preference',
      'dividends',
    ],
    riskCategories: [
      'dilution_risk',
      'liquidation_waterfall',
      'governance_control',
      'protective_provisions_scope',
      'exit_restrictions',
    ],
    keyTermsToExtract: [
      'Investment',
      'Valuation',
      'Series',
      'Preferred',
      'Liquidation Preference',
      'Board Seat',
      'Pro Rata',
    ],
    extractionHints: 'Extract investment amount, valuation, and equity terms. Focus on protective provisions, liquidation preferences, and governance rights.',
    mandatoryFields: ['investmentAmount', 'valuation', 'equityPercentage'],
    expectedSections: ['Investment', 'Valuation', 'Rights', 'Governance', 'Protective Provisions', 'Transfers'],
  },

  ROYALTY: {
    displayName: 'Royalty Agreement',
    description: 'Agreement for royalty payments based on usage, sales, or IP licensing',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'grant_of_rights',
      'royalty_rate',
      'royalty_base',
      'minimum_royalties',
      'payment_schedule',
      'reporting',
      'audit_rights',
      'exclusivity',
      'territory',
      'term',
    ],
    financialFields: [
      'royalty_rate',
      'minimum_guarantee',
      'advance_payment',
      'royalty_cap',
      'escalation_schedule',
    ],
    riskCategories: [
      'royalty_calculation_disputes',
      'audit_burden',
      'minimum_guarantee_risk',
      'territorial_restrictions',
      'term_limitations',
    ],
    keyTermsToExtract: [
      'Royalty Rate',
      'Net Sales',
      'Gross Revenue',
      'Minimum Guarantee',
      'Audit',
      'Territory',
    ],
    extractionHints: 'Extract royalty rates, calculation basis (net vs gross), and minimum guarantees. Focus on audit rights and payment schedules.',
    mandatoryFields: ['royaltyRate', 'royaltyBase', 'paymentSchedule'],
    expectedSections: ['Grant', 'Royalty Rate', 'Calculations', 'Payments', 'Reporting', 'Audit', 'Term'],
  },

  VARIATION: {
    displayName: 'Variation Agreement',
    description: 'Agreement modifying terms of an existing contract',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'required',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'variation_scope',
      'original_contract_reference',
      'modified_terms',
      'unchanged_terms',
      'effective_date',
      'consideration',
      'representations',
      'entire_agreement',
    ],
    financialFields: [
      'additional_cost',
      'revised_total',
      'cost_adjustment',
      'payment_modification',
    ],
    riskCategories: [
      'scope_creep',
      'unclear_modifications',
      'consideration_adequacy',
      'original_terms_conflict',
    ],
    keyTermsToExtract: [
      'Original Agreement',
      'Variation',
      'Amendment',
      'Modified Terms',
      'Effective Date',
      'Additional Consideration',
    ],
    extractionHints: 'Identify the original contract being varied. Extract specific terms being modified vs unchanged. Note any additional consideration for the variation.',
    mandatoryFields: ['originalContractReference', 'variationScope', 'effectiveDate'],
    expectedSections: ['Recitals', 'Definitions', 'Variations', 'Unchanged Terms', 'General'],
  },

  ENGAGEMENT_LETTER: {
    displayName: 'Engagement Letter',
    description: 'Letter agreement for professional services engagement (legal, accounting, consulting)',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'scope_of_engagement',
      'services_description',
      'fees_and_billing',
      'payment_terms',
      'client_responsibilities',
      'confidentiality',
      'conflicts_of_interest',
      'limitation_of_liability',
      'termination',
      'document_retention',
    ],
    financialFields: [
      'hourly_rates',
      'fixed_fee',
      'retainer',
      'expense_policy',
      'billing_frequency',
      'payment_terms',
    ],
    riskCategories: [
      'scope_ambiguity',
      'fee_dispute_risk',
      'liability_exposure',
      'conflict_of_interest',
      'professional_negligence',
    ],
    keyTermsToExtract: [
      'Engagement',
      'Scope of Services',
      'Fees',
      'Retainer',
      'Client',
      'Matter',
      'Billing Rate',
    ],
    extractionHints: 'Extract scope of engagement, fee structure (hourly/fixed/retainer), and billing terms. Identify client responsibilities and any limitations on liability.',
    mandatoryFields: ['scopeOfServices', 'feeStructure', 'parties'],
    expectedSections: ['Scope', 'Fees', 'Billing', 'Client Responsibilities', 'Confidentiality', 'Termination'],
  },

  AMENDMENT: {
    displayName: 'Contract Amendment',
    description: 'Formal amendment to an existing contract',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'required',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'amendment_number',
      'original_agreement',
      'amended_provisions',
      'ratification',
      'effective_date',
      'counterparts',
    ],
    financialFields: [
      'price_adjustment',
      'additional_fees',
      'revised_payment_schedule',
    ],
    riskCategories: [
      'conflicting_terms',
      'unintended_changes',
      'consideration_issues',
      'authorization',
    ],
    keyTermsToExtract: [
      'Amendment',
      'Original Agreement',
      'Hereby Amended',
      'Effective Date',
      'Ratify',
    ],
    extractionHints: 'Identify amendment number and original agreement. Extract specific sections being amended with before/after changes.',
    mandatoryFields: ['amendmentNumber', 'originalAgreementReference', 'amendedSections'],
    expectedSections: ['Recitals', 'Amendments', 'Ratification', 'Miscellaneous'],
  },

  ADDENDUM: {
    displayName: 'Contract Addendum',
    description: 'Additional terms or schedules added to an existing contract',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'required',
      CONTACTS: 'optional',
    },
    clauseCategories: [
      'addendum_scope',
      'additional_terms',
      'supplemental_provisions',
      'incorporation',
      'conflict_resolution',
    ],
    financialFields: [
      'additional_pricing',
      'supplemental_fees',
    ],
    riskCategories: [
      'conflict_with_original',
      'scope_expansion',
      'unclear_incorporation',
    ],
    keyTermsToExtract: [
      'Addendum',
      'Supplement',
      'Additional Terms',
      'Incorporated By Reference',
    ],
    extractionHints: 'Extract the additional terms being added. Identify how addendum relates to and is incorporated into the original agreement.',
    mandatoryFields: ['originalAgreementReference', 'additionalTerms'],
    expectedSections: ['Introduction', 'Additional Terms', 'Incorporation', 'Signatures'],
  },

  MEMORANDUM_OF_UNDERSTANDING: {
    displayName: 'Memorandum of Understanding (MOU)',
    description: 'Non-binding or preliminary agreement outlining intent between parties',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'purpose',
      'mutual_understanding',
      'responsibilities',
      'timeline',
      'non_binding',
      'confidentiality',
      'exclusivity',
      'termination',
    ],
    financialFields: [
      'estimated_value',
      'cost_sharing',
      'funding_commitment',
    ],
    riskCategories: [
      'enforceability_uncertainty',
      'binding_provisions',
      'exclusivity_lock_in',
      'reputational_risk',
    ],
    keyTermsToExtract: [
      'Understanding',
      'Intent',
      'Non-Binding',
      'Good Faith',
      'Mutual Agreement',
      'Exclusivity',
    ],
    extractionHints: 'Determine if MOU is binding or non-binding. Extract mutual understandings, any exclusivity provisions, and timeline for definitive agreement.',
    mandatoryFields: ['purpose', 'parties', 'bindingStatus'],
    expectedSections: ['Purpose', 'Understanding', 'Responsibilities', 'Timeline', 'Binding Status', 'Signatures'],
  },

  LETTER_OF_INTENT: {
    displayName: 'Letter of Intent (LOI)',
    description: 'Preliminary agreement expressing intention to enter into a transaction',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'transaction_description',
      'purchase_price',
      'due_diligence',
      'exclusivity',
      'confidentiality',
      'conditions_precedent',
      'break_fee',
      'binding_provisions',
      'non_binding_provisions',
      'timeline',
    ],
    financialFields: [
      'purchase_price',
      'deposit',
      'break_fee',
      'due_diligence_costs',
    ],
    riskCategories: [
      'binding_vs_nonbinding',
      'exclusivity_period',
      'break_fee_exposure',
      'due_diligence_scope',
      'deal_certainty',
    ],
    keyTermsToExtract: [
      'Intent',
      'Purchase Price',
      'Exclusivity',
      'Due Diligence',
      'Break Fee',
      'Binding',
      'Non-Binding',
    ],
    extractionHints: 'Identify which provisions are binding vs non-binding. Extract key deal terms, exclusivity period, and any break fees.',
    mandatoryFields: ['transactionDescription', 'bindingProvisions', 'exclusivityPeriod'],
    expectedSections: ['Transaction', 'Price', 'Due Diligence', 'Exclusivity', 'Binding Terms', 'Timeline'],
  },

  SUPPLY: {
    displayName: 'Supply Agreement',
    description: 'Agreement for ongoing supply of goods or materials',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'products',
      'specifications',
      'pricing',
      'ordering',
      'delivery',
      'acceptance',
      'quality_standards',
      'warranty',
      'volume_commitments',
      'exclusivity',
      'force_majeure',
    ],
    financialFields: [
      'unit_price',
      'volume_discounts',
      'minimum_order',
      'price_adjustment',
      'payment_terms',
    ],
    riskCategories: [
      'supply_disruption',
      'quality_issues',
      'price_volatility',
      'volume_commitment_risk',
      'single_source_dependency',
    ],
    keyTermsToExtract: [
      'Products',
      'Specifications',
      'Delivery',
      'Acceptance',
      'Warranty',
      'Minimum Order',
    ],
    extractionHints: 'Extract product specifications, pricing structure, volume commitments, and delivery terms. Focus on quality standards and remedies.',
    mandatoryFields: ['products', 'pricing', 'deliveryTerms'],
    expectedSections: ['Products', 'Pricing', 'Orders', 'Delivery', 'Quality', 'Warranty', 'Term'],
  },

  MANUFACTURING: {
    displayName: 'Manufacturing Agreement',
    description: 'Agreement for contract manufacturing of products',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'products',
      'specifications',
      'tooling',
      'raw_materials',
      'quality_control',
      'testing',
      'capacity',
      'pricing',
      'intellectual_property',
      'audit_rights',
      'regulatory_compliance',
    ],
    financialFields: [
      'per_unit_price',
      'tooling_costs',
      'nre_charges',
      'volume_pricing',
      'material_costs',
    ],
    riskCategories: [
      'quality_defects',
      'capacity_constraints',
      'ip_leakage',
      'regulatory_non_compliance',
      'supply_chain_risk',
    ],
    keyTermsToExtract: [
      'Specifications',
      'Tooling',
      'Quality',
      'Capacity',
      'NRE',
      'Audit',
    ],
    extractionHints: 'Extract specifications, quality requirements, capacity commitments, and IP ownership. Focus on tooling costs and NRE charges.',
    mandatoryFields: ['specifications', 'qualityStandards', 'pricing'],
    expectedSections: ['Products', 'Specifications', 'Quality', 'Pricing', 'IP', 'Term'],
  },

  RESELLER: {
    displayName: 'Reseller Agreement',
    description: 'Agreement granting rights to resell products or services',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'appointment',
      'territory',
      'products_services',
      'pricing_discounts',
      'ordering',
      'marketing',
      'training',
      'support',
      'exclusivity',
      'targets',
      'termination',
    ],
    financialFields: [
      'discount_rate',
      'msrp',
      'minimum_purchase',
      'marketing_development_funds',
      'rebates',
    ],
    riskCategories: [
      'target_shortfall',
      'territory_conflict',
      'price_undercutting',
      'support_obligations',
      'inventory_risk',
    ],
    keyTermsToExtract: [
      'Reseller',
      'Territory',
      'Discount',
      'Target',
      'MDF',
      'MSRP',
    ],
    extractionHints: 'Extract territory, discount structure, and sales targets. Identify marketing obligations and support requirements.',
    mandatoryFields: ['territory', 'discountStructure', 'products'],
    expectedSections: ['Appointment', 'Territory', 'Pricing', 'Orders', 'Marketing', 'Term'],
  },

  SPONSORSHIP: {
    displayName: 'Sponsorship Agreement',
    description: 'Agreement for event, team, or organization sponsorship',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'sponsorship_rights',
      'sponsorship_fee',
      'exclusivity',
      'branding_rights',
      'hospitality',
      'marketing_materials',
      'morality_clause',
      'termination',
      'insurance',
    ],
    financialFields: [
      'sponsorship_fee',
      'payment_schedule',
      'value_in_kind',
      'hospitality_value',
    ],
    riskCategories: [
      'reputational_damage',
      'event_cancellation',
      'exclusivity_breach',
      'morality_clause_trigger',
    ],
    keyTermsToExtract: [
      'Sponsorship',
      'Rights',
      'Exclusivity',
      'Hospitality',
      'Logo',
      'Morality Clause',
    ],
    extractionHints: 'Extract sponsorship fee, rights granted, and exclusivity scope. Identify hospitality benefits and morality/termination triggers.',
    mandatoryFields: ['sponsorshipFee', 'rights', 'term'],
    expectedSections: ['Grant of Rights', 'Sponsorship Fee', 'Benefits', 'Obligations', 'Term'],
  },

  SERVICES: {
    displayName: 'Services Agreement',
    description: 'General agreement for provision of professional services',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'required',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'scope_of_services',
      'service_levels',
      'pricing',
      'payment_terms',
      'personnel',
      'subcontracting',
      'intellectual_property',
      'confidentiality',
      'liability',
      'termination',
    ],
    financialFields: [
      'service_fees',
      'hourly_rates',
      'fixed_fees',
      'expenses',
      'payment_terms',
    ],
    riskCategories: [
      'scope_creep',
      'service_failure',
      'key_personnel_departure',
      'liability_exposure',
      'ip_ownership_dispute',
    ],
    keyTermsToExtract: [
      'Services',
      'Deliverables',
      'Fees',
      'Service Level',
      'Acceptance',
    ],
    extractionHints: 'Extract service scope, fee structure, and service levels. Focus on IP ownership and liability limitations.',
    mandatoryFields: ['serviceScope', 'fees', 'term'],
    expectedSections: ['Services', 'Fees', 'Term', 'Confidentiality', 'IP', 'Liability'],
  },

  CONSTRUCTION: {
    displayName: 'Construction Contract',
    description: 'Agreement for construction, renovation, or building works',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'scope_of_work',
      'contract_price',
      'payment_schedule',
      'progress_payments',
      'change_orders',
      'delays',
      'liquidated_damages',
      'warranties',
      'insurance',
      'safety',
      'completion',
      'retention',
      'defects_liability',
    ],
    financialFields: [
      'contract_price',
      'progress_payments',
      'retention_percentage',
      'liquidated_damages_rate',
      'variation_rates',
    ],
    riskCategories: [
      'cost_overrun',
      'delay_damages',
      'defects',
      'safety_incidents',
      'subcontractor_failure',
      'weather_delays',
    ],
    keyTermsToExtract: [
      'Contract Price',
      'Completion Date',
      'Practical Completion',
      'Defects Liability Period',
      'Retention',
      'Liquidated Damages',
      'Variation',
    ],
    extractionHints: 'Extract contract price, completion date, and liquidated damages. Focus on change order procedures and retention terms.',
    mandatoryFields: ['contractPrice', 'completionDate', 'scopeOfWork'],
    expectedSections: ['Scope', 'Price', 'Payment', 'Time', 'Variations', 'Completion', 'Defects'],
  },

  REAL_ESTATE: {
    displayName: 'Real Estate Agreement',
    description: 'Agreement for purchase, sale, or development of real property',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'property_description',
      'purchase_price',
      'deposit',
      'conditions_precedent',
      'due_diligence',
      'title',
      'representations_warranties',
      'closing',
      'prorations',
      'risk_of_loss',
    ],
    financialFields: [
      'purchase_price',
      'deposit',
      'earnest_money',
      'closing_costs',
      'prorations',
    ],
    riskCategories: [
      'title_defects',
      'environmental_issues',
      'financing_contingency',
      'appraisal_risk',
      'survey_issues',
    ],
    keyTermsToExtract: [
      'Property',
      'Purchase Price',
      'Deposit',
      'Closing Date',
      'Title',
      'Contingency',
    ],
    extractionHints: 'Extract property description, price, and closing date. Identify all contingencies and conditions precedent.',
    mandatoryFields: ['propertyDescription', 'purchasePrice', 'closingDate'],
    expectedSections: ['Property', 'Price', 'Deposit', 'Contingencies', 'Closing', 'Title'],
  },

  SHAREHOLDERS: {
    displayName: 'Shareholders Agreement',
    description: 'Agreement governing relationship between company shareholders',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'share_ownership',
      'governance',
      'board_composition',
      'reserved_matters',
      'transfer_restrictions',
      'pre_emption_rights',
      'tag_along',
      'drag_along',
      'deadlock',
      'exit',
      'non_compete',
      'confidentiality',
    ],
    financialFields: [
      'share_capital',
      'funding_obligations',
      'dividend_policy',
      'valuation_mechanism',
    ],
    riskCategories: [
      'minority_oppression',
      'deadlock',
      'exit_difficulty',
      'funding_disputes',
      'governance_conflicts',
    ],
    keyTermsToExtract: [
      'Shares',
      'Directors',
      'Reserved Matters',
      'Pre-emption',
      'Tag Along',
      'Drag Along',
      'Deadlock',
    ],
    extractionHints: 'Extract ownership percentages, governance rights, and transfer restrictions. Focus on reserved matters and exit mechanisms.',
    mandatoryFields: ['shareOwnership', 'reservedMatters', 'transferRestrictions'],
    expectedSections: ['Ownership', 'Governance', 'Transfers', 'Funding', 'Exit', 'Deadlock'],
  },

  OPERATING: {
    displayName: 'Operating Agreement',
    description: 'Agreement governing LLC operations and member relationships',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
    },
    clauseCategories: [
      'formation',
      'capital_contributions',
      'membership_interests',
      'management',
      'voting',
      'distributions',
      'allocations',
      'transfer_restrictions',
      'withdrawal',
      'dissolution',
      'indemnification',
    ],
    financialFields: [
      'capital_contributions',
      'membership_percentages',
      'distribution_priority',
      'capital_account',
    ],
    riskCategories: [
      'capital_call_risk',
      'management_disputes',
      'distribution_conflicts',
      'member_departure',
      'dissolution_trigger',
    ],
    keyTermsToExtract: [
      'Member',
      'Capital Contribution',
      'Membership Interest',
      'Manager',
      'Distribution',
      'Capital Account',
    ],
    extractionHints: 'Extract capital contributions, membership percentages, and management structure. Focus on distribution waterfall and exit provisions.',
    mandatoryFields: ['members', 'capitalContributions', 'managementStructure'],
    expectedSections: ['Formation', 'Capital', 'Management', 'Allocations', 'Distributions', 'Transfers'],
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
      NEGOTIATION_POINTS: 'optional',
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
  MSA: ['master services agreement', 'msa', 'master agreement', 'framework agreement'],
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
  FRANCHISE: ['franchise agreement', 'franchisee', 'franchisor', 'franchise fee', 'royalty', 'territory', 'system', 'marks'],
  DISTRIBUTION: ['distribution agreement', 'distributor', 'distribution rights', 'territory', 'minimum purchase', 'reseller'],
  AGENCY: ['agency agreement', 'agent', 'principal', 'commission', 'representation', 'sales agent', 'exclusive agent'],
  JOINT_VENTURE: ['joint venture', 'jv agreement', 'co-venture', 'venture partners', 'joint enterprise', 'profit sharing'],
  MAINTENANCE: ['maintenance agreement', 'service agreement', 'support agreement', 'preventive maintenance', 'response time', 'service level'],
  WARRANTY: ['warranty agreement', 'warranty terms', 'warranty period', 'covered defects', 'warranty claim', 'extended warranty'],
  INSURANCE: ['insurance policy', 'insurance agreement', 'policy', 'premium', 'insured', 'insurer', 'coverage', 'deductible', 'claim'],
  MERGER_ACQUISITION: ['merger agreement', 'acquisition agreement', 'purchase agreement', 'stock purchase', 'asset purchase', 'earnout', 'representations and warranties'],
  INVESTMENT: ['investment agreement', 'equity investment', 'convertible note', 'safe', 'series a', 'series b', 'preferred stock', 'valuation', 'liquidation preference'],
  ROYALTY: ['royalty agreement', 'royalty rate', 'royalty payment', 'net sales', 'gross revenue', 'minimum royalty', 'royalty base'],
  // New contract types
  VARIATION: ['variation agreement', 'variation order', 'contract variation', 'amended terms', 'modified agreement', 'change order'],
  ENGAGEMENT_LETTER: ['engagement letter', 'letter of engagement', 'professional engagement', 'client engagement', 'retainer', 'scope of engagement', 'professional services engagement'],
  AMENDMENT: ['amendment', 'amended and restated', 'first amendment', 'second amendment', 'contract amendment', 'hereby amended', 'modification agreement'],
  ADDENDUM: ['addendum', 'contract addendum', 'supplemental agreement', 'additional terms', 'attached addendum', 'incorporated addendum'],
  MEMORANDUM_OF_UNDERSTANDING: ['memorandum of understanding', 'mou', 'mutual understanding', 'non-binding agreement', 'preliminary agreement', 'letter of understanding'],
  LETTER_OF_INTENT: ['letter of intent', 'loi', 'term sheet', 'heads of terms', 'heads of agreement', 'indicative terms', 'non-binding offer'],
  SUPPLY: ['supply agreement', 'supply contract', 'supplier', 'supply of goods', 'materials supply', 'product supply', 'volume commitment'],
  MANUFACTURING: ['manufacturing agreement', 'contract manufacturing', 'toll manufacturing', 'oem agreement', 'manufacturing services', 'product manufacturing', 'nre'],
  RESELLER: ['reseller agreement', 'reseller', 'authorized reseller', 'value added reseller', 'var agreement', 'resale rights', 'channel partner'],
  SPONSORSHIP: ['sponsorship agreement', 'sponsorship', 'sponsor', 'event sponsorship', 'naming rights', 'branding rights', 'hospitality'],
  SERVICES: ['services agreement', 'professional services', 'service contract', 'service provider', 'service delivery', 'service fees'],
  CONSTRUCTION: ['construction contract', 'construction agreement', 'building contract', 'contractor', 'practical completion', 'liquidated damages', 'retention', 'defects liability', 'progress payment'],
  REAL_ESTATE: ['real estate', 'purchase and sale agreement', 'property agreement', 'conveyance', 'closing date', 'title insurance', 'earnest money', 'deed'],
  SHAREHOLDERS: ['shareholders agreement', 'shareholder', 'share ownership', 'drag along', 'tag along', 'pre-emption', 'reserved matters', 'board composition'],
  OPERATING: ['operating agreement', 'llc agreement', 'limited liability company', 'member', 'membership interest', 'capital contribution', 'capital account', 'manager'],
  OTHER: [],
};

// ============ HELPER FUNCTIONS ============

/**
 * Detect contract type using AI analysis (primary method)
 * Falls back to keyword matching if AI fails
 */
export async function detectContractTypeWithAI(text: string): Promise<{ type: ContractType; confidence: number; reasoning: string; matchedKeywords: string[] }> {
  try {
    const OpenAI = (await import('openai')).default;
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return convertKeywordResultToAIFormat(detectContractTypeKeywords(text));
    }
    
    const openai = new OpenAI({ apiKey });
    
    // Get list of available contract types for the AI
    const contractTypes = Object.keys(CONTRACT_TYPE_KEYWORDS).filter(t => t !== 'OTHER');
    
    // Prepare a sample of the text (first 3000 chars to stay within token limits)
    const textSample = text.slice(0, 3000);
    
    const prompt = `Analyze this contract excerpt and determine its type. Consider the overall context, structure, purpose, and language patterns - not just keyword matching.

Contract Text:
"""
${textSample}
"""

Available Contract Types:
${contractTypes.map(type => `- ${type}: ${CONTRACT_TYPE_PROFILES[type as ContractType]?.displayName || type}`).join('\n')}

Respond with a JSON object in this exact format:
{
  "type": "CONTRACT_TYPE",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this is the detected type"
}

Rules:
1. Use the exact contract type key (e.g., "SOW" not "Statement of Work")
2. Confidence should be 0.0 to 1.0
3. Consider the full context and intent of the document
4. If truly uncertain, use "OTHER" with lower confidence
5. Look for structural patterns, not just keywords`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert legal contract analyst specializing in contract classification. You understand the nuances and context of different contract types.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const result = JSON.parse(content);
    
    // Validate the result
    if (!result.type || !contractTypes.includes(result.type)) {
      return convertKeywordResultToAIFormat(detectContractTypeKeywords(text));
    }

    const keywordHints = detectContractTypeKeywords(text);
    
    return {
      type: result.type as ContractType,
      confidence: Math.min(1.0, Math.max(0.0, result.confidence || 0.7)),
      reasoning: result.reasoning || 'AI analysis based on contract structure and content',
      matchedKeywords: keywordHints.matchedKeywords,
    };
    
  } catch {
    return convertKeywordResultToAIFormat(detectContractTypeKeywords(text));
  }
}

/**
 * Detect contract type from extracted text using keyword matching (fallback method)
 */
export function detectContractTypeKeywords(text: string): { type: ContractType; confidence: number; matchedKeywords: string[] } {
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

  const topScore = scores[0];
  if (scores.length === 0 || !topScore || topScore.score < 0.1) {
    return { type: 'OTHER', confidence: 0.5, matchedKeywords: [] };
  }

  return {
    type: topScore.type,
    confidence: Math.min(0.95, topScore.score + 0.3), // Boost confidence but cap at 95%
    matchedKeywords: topScore.matchedKeywords,
  };
}

/**
 * Legacy function for backward compatibility - now uses keyword matching
 * Use detectContractTypeWithAI for AI-based detection
 */
export function detectContractType(text: string): { type: ContractType; confidence: number; matchedKeywords: string[] } {
  return detectContractTypeKeywords(text);
}

/**
 * Helper to convert keyword result format to AI result format
 */
function convertKeywordResultToAIFormat(
  keywordResult: { type: ContractType; confidence: number; matchedKeywords: string[] }
): { type: ContractType; confidence: number; reasoning: string; matchedKeywords: string[] } {
  return {
    type: keywordResult.type,
    confidence: keywordResult.confidence,
    reasoning: `Keyword-based detection. Matched: ${keywordResult.matchedKeywords.slice(0, 3).join(', ')}`,
    matchedKeywords: keywordResult.matchedKeywords,
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
    FRANCHISE: {
      typicalDuration: '10-20 years',
      commonIssues: ['Territory encroachment', 'Excessive fees', 'Operational restrictions', 'Renewal uncertainty'],
      negotiationFocus: ['Initial fees', 'Royalty rates', 'Territory protection', 'Transfer rights'],
      industryBenchmarks: [
        { metric: 'Royalty Rate', typical: '4-8% of gross sales' },
        { metric: 'Advertising Fee', typical: '1-4% of gross sales' },
        { metric: 'Initial Term', typical: '10-20 years' }
      ]
    },
    DISTRIBUTION: {
      typicalDuration: '1-5 years',
      commonIssues: ['Minimum purchase requirements', 'Territory limitations', 'Price controls', 'Termination exposure'],
      negotiationFocus: ['Minimum commitments', 'Exclusivity scope', 'Pricing flexibility', 'Termination rights'],
      industryBenchmarks: [
        { metric: 'Payment Terms', typical: 'Net 30-60' },
        { metric: 'Minimum Purchase', typical: 'Varies by industry' }
      ]
    },
    AGENCY: {
      typicalDuration: '1-3 years',
      commonIssues: ['Commission disputes', 'Authority scope', 'Competitive restrictions', 'Termination compensation'],
      negotiationFocus: ['Commission rates', 'Territory', 'Exclusivity', 'Termination notice'],
      industryBenchmarks: [
        { metric: 'Commission Rate', typical: '5-20% depending on industry' },
        { metric: 'Notice Period', typical: '30-90 days' }
      ]
    },
    JOINT_VENTURE: {
      typicalDuration: '5-15 years or project-based',
      commonIssues: ['Governance deadlocks', 'Exit difficulties', 'Contribution disputes', 'Competitive conflicts'],
      negotiationFocus: ['Ownership split', 'Decision thresholds', 'Exit mechanisms', 'Non-compete scope'],
      industryBenchmarks: [
        { metric: 'Major Decision Threshold', typical: 'Unanimous or 75%+' },
        { metric: 'Exit Notice', typical: '6-12 months' }
      ]
    },
    MAINTENANCE: {
      typicalDuration: '1-3 years with renewal',
      commonIssues: ['Service gaps', 'Response time failures', 'Hidden costs', 'Exclusion abuse'],
      negotiationFocus: ['Response times', 'Coverage scope', 'Price caps', 'SLA credits'],
      industryBenchmarks: [
        { metric: 'Response Time', typical: '2-8 hours' },
        { metric: 'Price Escalation', typical: '2-5% annually' }
      ]
    },
    WARRANTY: {
      typicalDuration: '1-5 years',
      commonIssues: ['Narrow coverage', 'Broad exclusions', 'Limited remedies', 'Complex claims process'],
      negotiationFocus: ['Coverage scope', 'Exclusion limits', 'Remedy options', 'Claims timeline'],
      industryBenchmarks: [
        { metric: 'Standard Warranty', typical: '1 year' },
        { metric: 'Extended Warranty', typical: '2-5 years' }
      ]
    },
    INSURANCE: {
      typicalDuration: '1 year renewable',
      commonIssues: ['Coverage gaps', 'Exclusion exposure', 'Inadequate limits', 'Claims complexity'],
      negotiationFocus: ['Coverage limits', 'Deductibles', 'Exclusion carve-outs', 'Claims process'],
      industryBenchmarks: [
        { metric: 'Deductible Range', typical: 'Varies by coverage type' },
        { metric: 'Premium Increase', typical: '3-10% annually' }
      ]
    },
    MERGER_ACQUISITION: {
      typicalDuration: 'One-time transaction',
      commonIssues: ['Rep & warranty exposure', 'Earnout disputes', 'Integration risk', 'Regulatory delays'],
      negotiationFocus: ['Purchase price', 'Indemnification caps', 'Escrow terms', 'Earnout conditions'],
      industryBenchmarks: [
        { metric: 'Escrow Holdback', typical: '10-15% of purchase price' },
        { metric: 'Indemnity Cap', typical: '10-25% of purchase price' },
        { metric: 'Rep Survival', typical: '12-24 months' }
      ]
    },
    INVESTMENT: {
      typicalDuration: 'Until exit event',
      commonIssues: ['Dilution concerns', 'Governance control loss', 'Exit restrictions', 'Valuation disputes'],
      negotiationFocus: ['Valuation', 'Liquidation preference', 'Board seats', 'Protective provisions'],
      industryBenchmarks: [
        { metric: 'Liquidation Preference', typical: '1x non-participating' },
        { metric: 'Anti-dilution', typical: 'Broad-based weighted average' }
      ]
    },
    ROYALTY: {
      typicalDuration: '3-10 years or life of IP',
      commonIssues: ['Calculation disputes', 'Audit burden', 'Minimum guarantee risk', 'Territory restrictions'],
      negotiationFocus: ['Royalty rate', 'Calculation basis', 'Audit rights', 'Minimum guarantees'],
      industryBenchmarks: [
        { metric: 'Royalty Rate', typical: '1-15% depending on industry' },
        { metric: 'Audit Frequency', typical: 'Once per year' }
      ]
    },
    VARIATION: {
      typicalDuration: 'Matches original contract',
      commonIssues: ['Unclear modification scope', 'Consideration inadequacy', 'Conflict with original terms', 'Authorization gaps'],
      negotiationFocus: ['Clear definition of changes', 'Additional consideration', 'Integration with original', 'Effective date'],
      industryBenchmarks: [
        { metric: 'Processing Time', typical: '1-4 weeks' },
        { metric: 'Cost Impact', typical: 'Should reflect value of changes' }
      ]
    },
    ENGAGEMENT_LETTER: {
      typicalDuration: 'Matter-based or 1-3 years',
      commonIssues: ['Scope ambiguity', 'Fee disputes', 'Liability exposure', 'Conflict of interest', 'Termination complexity'],
      negotiationFocus: ['Scope definition', 'Fee structure', 'Billing practices', 'Liability cap', 'Termination rights'],
      industryBenchmarks: [
        { metric: 'Billing Frequency', typical: 'Monthly' },
        { metric: 'Payment Terms', typical: 'Net 30 days' },
        { metric: 'Retainer', typical: 'Varies by matter complexity' }
      ]
    },
    AMENDMENT: {
      typicalDuration: 'Matches original contract',
      commonIssues: ['Conflicting terms', 'Authorization issues', 'Version control', 'Integration problems'],
      negotiationFocus: ['Clear before/after language', 'Effective date', 'Ratification of unchanged terms'],
      industryBenchmarks: [
        { metric: 'Amendment Numbering', typical: 'Sequential (First, Second, etc.)' },
        { metric: 'Execution Timeline', typical: '1-2 weeks' }
      ]
    },
    ADDENDUM: {
      typicalDuration: 'Matches original contract',
      commonIssues: ['Conflict resolution unclear', 'Incorporation ambiguity', 'Scope creep'],
      negotiationFocus: ['Clear incorporation language', 'Conflict hierarchy', 'Integration with base agreement'],
      industryBenchmarks: [
        { metric: 'Common Use', typical: 'Adding schedules, exhibits, or supplemental terms' }
      ]
    },
    MEMORANDUM_OF_UNDERSTANDING: {
      typicalDuration: '6-24 months until definitive agreement',
      commonIssues: ['Binding vs non-binding confusion', 'Exclusivity lock-in', 'Enforcement uncertainty', 'Timeline slippage'],
      negotiationFocus: ['Binding provisions', 'Exclusivity terms', 'Confidentiality', 'Timeline to definitive agreement'],
      industryBenchmarks: [
        { metric: 'Timeline to Definitive', typical: '3-12 months' },
        { metric: 'Exclusivity Period', typical: '30-90 days' }
      ]
    },
    LETTER_OF_INTENT: {
      typicalDuration: '30-180 days exclusivity',
      commonIssues: ['Binding confusion', 'Exclusivity cost', 'Break fee exposure', 'Due diligence scope'],
      negotiationFocus: ['Binding vs non-binding terms', 'Exclusivity period', 'Break fee', 'Conditions precedent'],
      industryBenchmarks: [
        { metric: 'Exclusivity Period', typical: '30-90 days' },
        { metric: 'Break Fee', typical: '1-3% of deal value' },
        { metric: 'Deposit', typical: '1-5% of purchase price' }
      ]
    },
    SUPPLY: {
      typicalDuration: '1-5 years',
      commonIssues: ['Supply disruption', 'Quality inconsistency', 'Price volatility', 'Volume commitment shortfall'],
      negotiationFocus: ['Pricing mechanism', 'Volume commitments', 'Quality standards', 'Delivery terms'],
      industryBenchmarks: [
        { metric: 'Payment Terms', typical: 'Net 30-60 days' },
        { metric: 'Quality Defect Rate', typical: '<1% target' }
      ]
    },
    MANUFACTURING: {
      typicalDuration: '2-5 years',
      commonIssues: ['Quality defects', 'Capacity constraints', 'IP leakage', 'Cost overruns', 'Supply chain disruption'],
      negotiationFocus: ['Specifications', 'Quality standards', 'IP protection', 'Capacity guarantees', 'Pricing'],
      industryBenchmarks: [
        { metric: 'Defect Rate', typical: '<0.5% target' },
        { metric: 'Capacity Buffer', typical: '10-20% above forecast' },
        { metric: 'Payment Terms', typical: 'Net 30-45 days' }
      ]
    },
    RESELLER: {
      typicalDuration: '1-3 years',
      commonIssues: ['Target shortfall', 'Territory conflicts', 'Price undercutting', 'Support burden'],
      negotiationFocus: ['Discount structure', 'Territory', 'Sales targets', 'Marketing support'],
      industryBenchmarks: [
        { metric: 'Discount off MSRP', typical: '20-40%' },
        { metric: 'MDF Allocation', typical: '2-5% of sales' }
      ]
    },
    SPONSORSHIP: {
      typicalDuration: '1-5 years',
      commonIssues: ['Event cancellation', 'Reputational damage', 'Rights enforcement', 'ROI measurement'],
      negotiationFocus: ['Rights granted', 'Exclusivity', 'Hospitality', 'Morality clause', 'Cancellation terms'],
      industryBenchmarks: [
        { metric: 'Sponsorship Tiers', typical: 'Title, Presenting, Supporting' },
        { metric: 'Activation Ratio', typical: '1:1 to 2:1 (activation spend to fee)' }
      ]
    },
    SERVICES: {
      typicalDuration: '1-3 years',
      commonIssues: ['Scope creep', 'Service quality', 'Key personnel dependency', 'IP ownership'],
      negotiationFocus: ['Service scope', 'Pricing', 'Service levels', 'IP rights', 'Termination'],
      industryBenchmarks: [
        { metric: 'Payment Terms', typical: 'Net 30 days' },
        { metric: 'Liability Cap', typical: '1-2x annual fees' }
      ]
    },
    CONSTRUCTION: {
      typicalDuration: 'Project-based (6 months to 5+ years)',
      commonIssues: ['Cost overruns', 'Delays', 'Change order disputes', 'Defects', 'Safety incidents'],
      negotiationFocus: ['Price and payment', 'Timeline', 'Change order process', 'Liquidated damages', 'Warranties'],
      industryBenchmarks: [
        { metric: 'Retention', typical: '5-10%' },
        { metric: 'Defects Liability Period', typical: '12-24 months' },
        { metric: 'Liquidated Damages', typical: '0.1-0.5% per day/week' }
      ]
    },
    REAL_ESTATE: {
      typicalDuration: 'Transaction-based (30-90 day closing)',
      commonIssues: ['Title defects', 'Financing contingency', 'Environmental issues', 'Survey problems'],
      negotiationFocus: ['Purchase price', 'Contingencies', 'Closing timeline', 'Representations'],
      industryBenchmarks: [
        { metric: 'Earnest Money', typical: '1-3% of purchase price' },
        { metric: 'Due Diligence Period', typical: '30-60 days' },
        { metric: 'Closing Timeline', typical: '30-90 days' }
      ]
    },
    SHAREHOLDERS: {
      typicalDuration: 'Until exit or dissolution',
      commonIssues: ['Minority oppression', 'Deadlock', 'Exit difficulty', 'Funding disputes', 'Governance conflicts'],
      negotiationFocus: ['Reserved matters', 'Transfer restrictions', 'Tag/drag rights', 'Exit mechanisms'],
      industryBenchmarks: [
        { metric: 'Board Representation', typical: 'Proportional to ownership' },
        { metric: 'Pre-emption Notice', typical: '30-60 days' }
      ]
    },
    OPERATING: {
      typicalDuration: 'Life of LLC',
      commonIssues: ['Capital call disputes', 'Distribution conflicts', 'Management control', 'Member exit'],
      negotiationFocus: ['Capital contributions', 'Distribution waterfall', 'Management rights', 'Transfer restrictions'],
      industryBenchmarks: [
        { metric: 'Manager Appointment', typical: 'Majority vote or designated' },
        { metric: 'Capital Call Notice', typical: '10-30 days' }
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
