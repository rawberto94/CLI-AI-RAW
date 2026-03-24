/**
 * Contract Type Profiles
 * 
 * Defines contract-type-specific extraction rules, relevant artifacts,
 * mandatory/optional fields, and clause categories for adaptive AI extraction.
 */

// ============ CONTRACT/DOCUMENT TYPES ============
// Includes both contracts and transactional business documents

export type ContractType = 
  // === CORE AGREEMENTS ===
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
  // === TRANSACTIONAL DOCUMENTS ===
  | 'PURCHASE_ORDER'
  | 'INVOICE'
  | 'QUOTE'
  | 'PROPOSAL'
  | 'RECEIPT'
  | 'BILL_OF_LADING'
  | 'PACKING_LIST'
  | 'DELIVERY_NOTE'
  // === COMPLIANCE & REGULATORY ===
  | 'DATA_PROCESSING_AGREEMENT'
  | 'TERMS_OF_SERVICE'
  | 'PRIVACY_POLICY'
  | 'ACCEPTABLE_USE_POLICY'
  | 'CODE_OF_CONDUCT'
  | 'CERTIFICATION'
  // === CORPORATE DOCUMENTS ===
  | 'BOARD_RESOLUTION'
  | 'MINUTES'
  | 'POWER_OF_ATTORNEY'
  | 'CORPORATE_GUARANTEE'
  | 'LETTER_OF_CREDIT'
  // === PROJECT & WORK ===
  | 'WORK_ORDER'
  | 'CHANGE_ORDER'
  | 'REQUEST_FOR_PROPOSAL'
  | 'REQUEST_FOR_QUOTE'
  | 'SCOPE_CHANGE'
  | 'PROJECT_CHARTER'
  // === HR & PERSONNEL ===
  | 'OFFER_LETTER'
  | 'SEPARATION_AGREEMENT'
  | 'NON_COMPETE'
  | 'NON_SOLICITATION'
  | 'INDEPENDENT_CONTRACTOR'
  // === CATCH-ALL ===
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
  | 'CONTACTS'
  | 'PARTIES'
  | 'TIMELINE'
  | 'DELIVERABLES'
  | 'EXECUTIVE_SUMMARY'
  | 'RATES'
  | 'DI_METADATA';

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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'not-applicable',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'required',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'required',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'required',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'not-applicable',
      EXECUTIVE_SUMMARY: 'optional',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'not-applicable',
      EXECUTIVE_SUMMARY: 'optional',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'not-applicable',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'required',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'required',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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

  // ============ TRANSACTIONAL DOCUMENTS ============

  PURCHASE_ORDER: {
    displayName: 'Purchase Order',
    description: 'Commercial document issued to a seller indicating types, quantities, and agreed prices',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'not-applicable',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
    },
    clauseCategories: [
      'item_description',
      'quantity',
      'unit_price',
      'delivery_terms',
      'payment_terms',
      'shipping_instructions',
      'acceptance_criteria',
    ],
    financialFields: [
      'total_amount',
      'unit_prices',
      'taxes',
      'shipping_cost',
      'discount',
      'payment_terms',
    ],
    riskCategories: [
      'delivery_delays',
      'quality_mismatch',
      'price_discrepancies',
    ],
    keyTermsToExtract: [
      'PO Number',
      'Vendor',
      'Ship To',
      'Bill To',
      'Item',
      'Quantity',
      'Unit Price',
      'Delivery Date',
    ],
    extractionHints: 'Focus on line items, quantities, prices, and delivery dates. Extract PO number, vendor details, and shipping/billing addresses.',
    mandatoryFields: ['poNumber', 'vendor', 'lineItems', 'totalAmount'],
    expectedSections: ['Header', 'Line Items', 'Shipping', 'Billing', 'Terms'],
  },

  INVOICE: {
    displayName: 'Invoice',
    description: 'Commercial document issued by seller to buyer for goods or services provided',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'not-applicable',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
    },
    clauseCategories: [
      'billing_details',
      'line_items',
      'payment_terms',
      'due_date',
      'tax_details',
    ],
    financialFields: [
      'invoice_amount',
      'subtotal',
      'taxes',
      'discounts',
      'total_due',
      'currency',
      'payment_terms',
    ],
    riskCategories: [
      'late_payment',
      'disputed_charges',
      'incorrect_amounts',
    ],
    keyTermsToExtract: [
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Bill To',
      'Amount Due',
      'Payment Terms',
    ],
    extractionHints: 'Extract invoice number, dates, amounts, line items, and payment terms. Calculate totals and identify any discounts or taxes.',
    mandatoryFields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'totalAmount'],
    expectedSections: ['Header', 'Bill To', 'Line Items', 'Summary', 'Payment Instructions'],
  },

  QUOTE: {
    displayName: 'Quote/Quotation',
    description: 'Formal statement of pricing for goods or services before purchase',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'optional',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
    },
    clauseCategories: [
      'scope_of_work',
      'pricing',
      'validity_period',
      'terms_conditions',
      'delivery_timeline',
    ],
    financialFields: [
      'quoted_price',
      'unit_prices',
      'volume_discounts',
      'validity_period',
      'payment_terms',
    ],
    riskCategories: [
      'price_changes',
      'scope_ambiguity',
      'timeline_uncertainty',
    ],
    keyTermsToExtract: [
      'Quote Number',
      'Valid Until',
      'Total Price',
      'Lead Time',
      'Terms',
    ],
    extractionHints: 'Extract pricing, validity period, and scope. Identify any conditions or exclusions that affect the quote.',
    mandatoryFields: ['quoteNumber', 'quotedPrice', 'validityDate'],
    expectedSections: ['Quote Details', 'Pricing', 'Terms', 'Validity'],
  },

  PROPOSAL: {
    displayName: 'Business Proposal',
    description: 'Formal document proposing goods, services, or solutions to a prospective client',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
    },
    clauseCategories: [
      'executive_summary',
      'problem_statement',
      'proposed_solution',
      'pricing',
      'timeline',
      'team',
      'terms',
    ],
    financialFields: [
      'total_investment',
      'pricing_options',
      'payment_schedule',
      'roi_projections',
    ],
    riskCategories: [
      'scope_creep',
      'unrealistic_timeline',
      'budget_overrun',
    ],
    keyTermsToExtract: [
      'Proposal',
      'Solution',
      'Investment',
      'Timeline',
      'Deliverables',
    ],
    extractionHints: 'Extract proposed solution, pricing options, timeline, and deliverables. Identify assumptions and exclusions.',
    mandatoryFields: ['proposedSolution', 'pricing', 'timeline'],
    expectedSections: ['Executive Summary', 'Solution', 'Pricing', 'Timeline', 'Team', 'Terms'],
  },

  RECEIPT: {
    displayName: 'Receipt',
    description: 'Document acknowledging payment received for goods or services',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'not-applicable',
      FINANCIAL: 'required',
      RISK: 'not-applicable',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'not-applicable',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'payment_details',
      'items_purchased',
      'payment_method',
    ],
    financialFields: [
      'amount_paid',
      'payment_method',
      'receipt_date',
      'reference_number',
    ],
    riskCategories: [],
    keyTermsToExtract: [
      'Receipt Number',
      'Amount',
      'Date',
      'Payment Method',
    ],
    extractionHints: 'Extract payment amount, date, method, and what was paid for. Simple document type.',
    mandatoryFields: ['amount', 'date', 'payer'],
    expectedSections: ['Payment Details', 'Items'],
  },

  BILL_OF_LADING: {
    displayName: 'Bill of Lading',
    description: 'Legal document between shipper and carrier detailing goods transported',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'shipper_details',
      'consignee_details',
      'goods_description',
      'weight_dimensions',
      'carrier_liability',
      'delivery_terms',
    ],
    financialFields: [
      'freight_charges',
      'declared_value',
      'insurance',
    ],
    riskCategories: [
      'cargo_damage',
      'delivery_delays',
      'liability_limitations',
    ],
    keyTermsToExtract: [
      'Shipper',
      'Consignee',
      'Carrier',
      'Port of Loading',
      'Port of Discharge',
      'Vessel',
      'Container',
    ],
    extractionHints: 'Extract shipping details, cargo description, and liability terms. Important for international trade.',
    mandatoryFields: ['shipper', 'consignee', 'cargoDescription', 'vesselName'],
    expectedSections: ['Shipper', 'Consignee', 'Cargo', 'Vessel', 'Terms'],
  },

  // ============ COMPLIANCE & REGULATORY ============

  DATA_PROCESSING_AGREEMENT: {
    displayName: 'Data Processing Agreement (DPA)',
    description: 'Agreement governing data processing between controller and processor',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'not-applicable',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'data_categories',
      'processing_purposes',
      'data_subject_rights',
      'security_measures',
      'subprocessors',
      'data_transfers',
      'audit_rights',
      'breach_notification',
    ],
    financialFields: [],
    riskCategories: [
      'gdpr_compliance',
      'data_breach_exposure',
      'subprocessor_risk',
      'cross_border_transfers',
    ],
    keyTermsToExtract: [
      'Controller',
      'Processor',
      'Data Subject',
      'Personal Data',
      'Processing',
      'Subprocessor',
      'SCCs',
    ],
    extractionHints: 'Focus on data categories, processing purposes, security measures, and compliance requirements. Critical for GDPR/privacy compliance.',
    mandatoryFields: ['dataCategories', 'processingPurposes', 'securityMeasures', 'subprocessorProvisions'],
    expectedSections: ['Definitions', 'Processing', 'Security', 'Subprocessors', 'Transfers', 'Audit', 'Termination'],
  },

  TERMS_OF_SERVICE: {
    displayName: 'Terms of Service',
    description: 'Agreement defining terms for using a service or platform',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'acceptance',
      'permitted_use',
      'prohibited_use',
      'user_content',
      'intellectual_property',
      'disclaimers',
      'liability_limitations',
      'termination',
      'dispute_resolution',
    ],
    financialFields: [
      'subscription_fees',
      'payment_terms',
    ],
    riskCategories: [
      'liability_exposure',
      'content_liability',
      'service_availability',
      'data_rights',
    ],
    keyTermsToExtract: [
      'Acceptance',
      'User',
      'Service',
      'Content',
      'Prohibited',
      'Disclaimer',
    ],
    extractionHints: 'Extract user rights and restrictions, liability limitations, and termination provisions. Consumer-facing document.',
    mandatoryFields: ['acceptanceTerms', 'permittedUse', 'prohibitedUse', 'liability'],
    expectedSections: ['Acceptance', 'Use', 'Content', 'IP', 'Liability', 'Termination'],
  },

  // ============ CORPORATE DOCUMENTS ============

  BOARD_RESOLUTION: {
    displayName: 'Board Resolution',
    description: 'Formal record of decisions made by company board of directors',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'optional',
      RISK: 'optional',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'resolution_topic',
      'resolved_actions',
      'authorization',
      'effective_date',
    ],
    financialFields: [
      'authorized_amount',
    ],
    riskCategories: [
      'authorization_scope',
      'compliance_issues',
    ],
    keyTermsToExtract: [
      'RESOLVED',
      'WHEREAS',
      'Board of Directors',
      'Authorized',
      'Approved',
    ],
    extractionHints: 'Extract resolved actions, authorizations, and effective dates. Formal corporate document.',
    mandatoryFields: ['resolutions', 'effectiveDate'],
    expectedSections: ['Recitals', 'Resolutions', 'Signatures'],
  },

  POWER_OF_ATTORNEY: {
    displayName: 'Power of Attorney',
    description: 'Legal document authorizing someone to act on another\'s behalf',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'powers_granted',
      'limitations',
      'duration',
      'revocation',
      'successor_agent',
    ],
    financialFields: [
      'transaction_limits',
    ],
    riskCategories: [
      'scope_of_authority',
      'abuse_potential',
      'revocation_complexity',
    ],
    keyTermsToExtract: [
      'Principal',
      'Agent',
      'Attorney-in-Fact',
      'Powers',
      'Revocation',
    ],
    extractionHints: 'Extract powers granted, limitations, and duration. Identify whether durable or limited POA.',
    mandatoryFields: ['principal', 'agent', 'powersGranted'],
    expectedSections: ['Appointment', 'Powers', 'Limitations', 'Duration', 'Signatures'],
  },

  // ============ PROJECT & WORK DOCUMENTS ============

  WORK_ORDER: {
    displayName: 'Work Order',
    description: 'Document authorizing specific work to be performed',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
    },
    clauseCategories: [
      'scope_of_work',
      'timeline',
      'pricing',
      'acceptance',
      'change_process',
    ],
    financialFields: [
      'work_order_value',
      'hourly_rates',
      'materials_cost',
      'not_to_exceed',
    ],
    riskCategories: [
      'scope_creep',
      'timeline_delays',
      'cost_overruns',
    ],
    keyTermsToExtract: [
      'Work Order',
      'Scope',
      'Duration',
      'Rate',
      'Not to Exceed',
    ],
    extractionHints: 'Extract work scope, timeline, pricing, and any caps or limitations.',
    mandatoryFields: ['scope', 'timeline', 'pricing'],
    expectedSections: ['Scope', 'Timeline', 'Pricing', 'Acceptance'],
  },

  CHANGE_ORDER: {
    displayName: 'Change Order',
    description: 'Document modifying scope, cost, or schedule of existing contract',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'required',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
    },
    clauseCategories: [
      'change_description',
      'cost_impact',
      'schedule_impact',
      'approval',
    ],
    financialFields: [
      'change_amount',
      'revised_total',
      'schedule_extension',
    ],
    riskCategories: [
      'budget_impact',
      'timeline_extension',
      'scope_creep',
    ],
    keyTermsToExtract: [
      'Change Order',
      'Original Amount',
      'Change Amount',
      'Revised Amount',
      'Days Extension',
    ],
    extractionHints: 'Extract change description, cost impact, and schedule impact. Track cumulative changes.',
    mandatoryFields: ['changeDescription', 'costImpact', 'originalContract'],
    expectedSections: ['Change Description', 'Cost Impact', 'Schedule Impact', 'Approvals'],
  },

  REQUEST_FOR_PROPOSAL: {
    displayName: 'Request for Proposal (RFP)',
    description: 'Document soliciting proposals from vendors for goods or services',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'optional',
      RISK: 'optional',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'requirements',
      'evaluation_criteria',
      'submission_guidelines',
      'timeline',
      'terms_conditions',
    ],
    financialFields: [
      'budget_range',
      'pricing_format',
    ],
    riskCategories: [
      'unclear_requirements',
      'unrealistic_timeline',
      'evaluation_bias',
    ],
    keyTermsToExtract: [
      'RFP',
      'Requirements',
      'Evaluation Criteria',
      'Submission Deadline',
      'Questions Due',
    ],
    extractionHints: 'Extract requirements, evaluation criteria, timeline, and submission instructions.',
    mandatoryFields: ['requirements', 'submissionDeadline', 'evaluationCriteria'],
    expectedSections: ['Introduction', 'Requirements', 'Evaluation', 'Timeline', 'Submission'],
  },

  // ============ HR & PERSONNEL ============

  OFFER_LETTER: {
    displayName: 'Offer Letter',
    description: 'Letter extending formal job offer to candidate',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'position',
      'compensation',
      'start_date',
      'benefits',
      'contingencies',
      'at_will_statement',
    ],
    financialFields: [
      'base_salary',
      'bonus_target',
      'equity',
      'signing_bonus',
    ],
    riskCategories: [
      'contingency_failures',
      'compensation_disputes',
    ],
    keyTermsToExtract: [
      'Position',
      'Salary',
      'Start Date',
      'Reporting To',
      'Benefits',
      'Contingent Upon',
    ],
    extractionHints: 'Extract position, compensation, start date, and any contingencies. Simpler than full employment agreement.',
    mandatoryFields: ['position', 'salary', 'startDate'],
    expectedSections: ['Position', 'Compensation', 'Benefits', 'Start Date', 'Contingencies'],
  },

  SEPARATION_AGREEMENT: {
    displayName: 'Separation Agreement',
    description: 'Agreement governing terms of employment termination',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: [
      'separation_date',
      'severance_payment',
      'release_of_claims',
      'confidentiality',
      'non_disparagement',
      'return_of_property',
      'cooperation',
      'references',
    ],
    financialFields: [
      'severance_amount',
      'bonus_payout',
      'accrued_pto',
      'cobra_continuation',
      'outplacement_services',
    ],
    riskCategories: [
      'release_scope',
      'revocation_period',
      'confidentiality_breach',
    ],
    keyTermsToExtract: [
      'Separation Date',
      'Severance',
      'Release',
      'Consideration Period',
      'Revocation Period',
    ],
    extractionHints: 'Extract severance terms, release scope, and any post-employment obligations. Check for ADEA compliance.',
    mandatoryFields: ['separationDate', 'severanceAmount', 'releaseOfClaims'],
    expectedSections: ['Separation', 'Severance', 'Release', 'Confidentiality', 'Non-Disparagement'],
  },

  INDEPENDENT_CONTRACTOR: {
    displayName: 'Independent Contractor Agreement',
    description: 'Agreement engaging individual or entity as independent contractor',
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
      PARTIES: 'required',
      TIMELINE: 'required',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'required',
    },
    clauseCategories: [
      'services',
      'compensation',
      'independent_contractor_status',
      'taxes',
      'insurance',
      'confidentiality',
      'ip_ownership',
      'termination',
    ],
    financialFields: [
      'rate',
      'payment_terms',
      'expenses',
      'invoicing',
    ],
    riskCategories: [
      'misclassification_risk',
      'ip_ownership_disputes',
      'tax_liability',
    ],
    keyTermsToExtract: [
      'Contractor',
      'Independent Contractor',
      'Rate',
      'Services',
      'Work Product',
    ],
    extractionHints: 'Focus on contractor status provisions and IP ownership. Critical to distinguish from employment.',
    mandatoryFields: ['services', 'rate', 'independentContractorStatus', 'ipOwnership'],
    expectedSections: ['Services', 'Compensation', 'Contractor Status', 'IP', 'Confidentiality', 'Termination'],
  },

  // Catch-all documents
  PACKING_LIST: {
    displayName: 'Packing List',
    description: 'Document listing contents of shipment',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'not-applicable',
      FINANCIAL: 'optional',
      RISK: 'not-applicable',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'not-applicable',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['item_list', 'quantities', 'weights'],
    financialFields: ['declared_value'],
    riskCategories: [],
    keyTermsToExtract: ['Items', 'Quantity', 'Weight', 'Dimensions'],
    extractionHints: 'Extract item list, quantities, and shipping details.',
    mandatoryFields: ['items', 'shipper', 'consignee'],
    expectedSections: ['Items', 'Shipper', 'Consignee'],
  },

  DELIVERY_NOTE: {
    displayName: 'Delivery Note',
    description: 'Document accompanying delivered goods',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'not-applicable',
      FINANCIAL: 'optional',
      RISK: 'not-applicable',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'optional',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['items_delivered', 'recipient', 'delivery_date'],
    financialFields: [],
    riskCategories: ['delivery_disputes'],
    keyTermsToExtract: ['Delivery Note', 'Delivered To', 'Items', 'Date'],
    extractionHints: 'Extract items delivered, recipient, and delivery confirmation.',
    mandatoryFields: ['items', 'recipient', 'deliveryDate'],
    expectedSections: ['Items', 'Delivery Details', 'Confirmation'],
  },

  PRIVACY_POLICY: {
    displayName: 'Privacy Policy',
    description: 'Document describing how an organization collects, uses, and protects data',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'not-applicable',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['data_collected', 'data_use', 'data_sharing', 'user_rights', 'security', 'cookies', 'retention'],
    financialFields: [],
    riskCategories: ['compliance_gaps', 'data_breach_exposure', 'consent_issues'],
    keyTermsToExtract: ['Personal Information', 'Cookies', 'Third Parties', 'Rights', 'Opt-Out'],
    extractionHints: 'Extract data collection practices, sharing policies, and user rights. Check for GDPR/CCPA compliance.',
    mandatoryFields: ['dataCollected', 'dataUse', 'userRights', 'contact'],
    expectedSections: ['Data Collection', 'Data Use', 'Sharing', 'Rights', 'Security', 'Contact'],
  },

  ACCEPTABLE_USE_POLICY: {
    displayName: 'Acceptable Use Policy',
    description: 'Policy defining acceptable and prohibited uses of a service or system',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'not-applicable',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['permitted_use', 'prohibited_activities', 'enforcement', 'consequences'],
    financialFields: [],
    riskCategories: ['violation_exposure', 'enforcement_gaps'],
    keyTermsToExtract: ['Acceptable', 'Prohibited', 'Violation', 'Enforcement'],
    extractionHints: 'Extract permitted and prohibited activities, and enforcement mechanisms.',
    mandatoryFields: ['permittedUse', 'prohibitedActivities', 'consequences'],
    expectedSections: ['Permitted Use', 'Prohibited Activities', 'Enforcement', 'Consequences'],
  },

  CODE_OF_CONDUCT: {
    displayName: 'Code of Conduct',
    description: 'Document outlining behavioral expectations and ethical standards',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'not-applicable',
      RISK: 'optional',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['ethical_standards', 'expected_behavior', 'prohibited_conduct', 'reporting', 'consequences'],
    financialFields: [],
    riskCategories: ['compliance_violations', 'reporting_gaps'],
    keyTermsToExtract: ['Ethics', 'Conduct', 'Standards', 'Reporting', 'Violation'],
    extractionHints: 'Extract behavioral expectations, prohibited conduct, and reporting mechanisms.',
    mandatoryFields: ['standards', 'prohibitedConduct', 'reportingProcess'],
    expectedSections: ['Standards', 'Expected Behavior', 'Prohibited Conduct', 'Reporting', 'Consequences'],
  },

  CERTIFICATION: {
    displayName: 'Certification',
    description: 'Document certifying compliance, qualification, or achievement',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'not-applicable',
      FINANCIAL: 'not-applicable',
      RISK: 'optional',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'not-applicable',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'not-applicable',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['certification_type', 'requirements_met', 'validity', 'issuer'],
    financialFields: [],
    riskCategories: ['expiration', 'validity'],
    keyTermsToExtract: ['Certifies', 'Certified', 'Valid Until', 'Standards', 'Compliance'],
    extractionHints: 'Extract certification type, issuer, validity period, and standards met.',
    mandatoryFields: ['certificationType', 'issuedTo', 'validUntil'],
    expectedSections: ['Certification', 'Standards', 'Validity'],
  },

  MINUTES: {
    displayName: 'Meeting Minutes',
    description: 'Official record of proceedings at a meeting',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'not-applicable',
      FINANCIAL: 'optional',
      RISK: 'optional',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['attendees', 'agenda', 'discussions', 'resolutions', 'action_items'],
    financialFields: ['budget_approvals'],
    riskCategories: ['incomplete_records'],
    keyTermsToExtract: ['Present', 'Absent', 'Resolved', 'Action Item', 'Approved'],
    extractionHints: 'Extract attendees, discussions, resolutions, and action items.',
    mandatoryFields: ['date', 'attendees', 'resolutions'],
    expectedSections: ['Attendees', 'Agenda', 'Discussion', 'Resolutions', 'Action Items'],
  },

  CORPORATE_GUARANTEE: {
    displayName: 'Corporate Guarantee',
    description: 'Agreement where corporation guarantees obligations of another party',
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['guarantee_scope', 'guaranteed_obligations', 'limitations', 'termination', 'enforcement'],
    financialFields: ['guarantee_amount', 'maximum_liability'],
    riskCategories: ['unlimited_exposure', 'enforcement_risk', 'subsidiary_default'],
    keyTermsToExtract: ['Guarantor', 'Guaranteed Party', 'Guarantee', 'Primary Obligation', 'Demand'],
    extractionHints: 'Extract scope of guarantee, limitations, and enforcement mechanisms.',
    mandatoryFields: ['guarantor', 'guaranteedParty', 'guaranteedObligations', 'maximumAmount'],
    expectedSections: ['Guarantee', 'Scope', 'Limitations', 'Enforcement', 'Termination'],
  },

  LETTER_OF_CREDIT: {
    displayName: 'Letter of Credit',
    description: 'Bank guarantee of payment used in international trade',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'optional',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'required',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['credit_amount', 'beneficiary', 'required_documents', 'expiry', 'payment_terms'],
    financialFields: ['credit_amount', 'currency', 'fees'],
    riskCategories: ['documentary_compliance', 'expiry_risk', 'fraud'],
    keyTermsToExtract: ['Beneficiary', 'Applicant', 'Issuing Bank', 'Amount', 'Expiry Date', 'Documents Required'],
    extractionHints: 'Extract credit amount, required documents, expiry, and payment conditions.',
    mandatoryFields: ['beneficiary', 'amount', 'expiryDate', 'requiredDocuments'],
    expectedSections: ['Credit Details', 'Beneficiary', 'Documents', 'Terms', 'Expiry'],
  },

  SCOPE_CHANGE: {
    displayName: 'Scope Change Request',
    description: 'Document requesting changes to project scope',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'optional',
      AMENDMENTS: 'required',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
    },
    clauseCategories: ['current_scope', 'proposed_changes', 'impact_analysis', 'justification'],
    financialFields: ['cost_impact', 'budget_change'],
    riskCategories: ['budget_overrun', 'timeline_impact', 'scope_creep'],
    keyTermsToExtract: ['Current Scope', 'Proposed', 'Impact', 'Cost', 'Timeline'],
    extractionHints: 'Extract current scope, proposed changes, and impact analysis.',
    mandatoryFields: ['currentScope', 'proposedChanges', 'costImpact'],
    expectedSections: ['Current Scope', 'Proposed Changes', 'Impact', 'Approval'],
  },

  PROJECT_CHARTER: {
    displayName: 'Project Charter',
    description: 'Document formally authorizing a project and defining its scope',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'required',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'optional',
    },
    clauseCategories: ['project_purpose', 'objectives', 'scope', 'stakeholders', 'budget', 'timeline', 'risks'],
    financialFields: ['project_budget', 'funding_source'],
    riskCategories: ['scope_clarity', 'stakeholder_alignment', 'resource_availability'],
    keyTermsToExtract: ['Project', 'Objectives', 'Scope', 'Sponsor', 'Budget', 'Milestones'],
    extractionHints: 'Extract project purpose, objectives, scope, budget, and key stakeholders.',
    mandatoryFields: ['projectName', 'objectives', 'scope', 'sponsor', 'budget'],
    expectedSections: ['Purpose', 'Objectives', 'Scope', 'Stakeholders', 'Budget', 'Timeline', 'Risks'],
  },

  REQUEST_FOR_QUOTE: {
    displayName: 'Request for Quote (RFQ)',
    description: 'Document requesting pricing information from vendors',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'optional',
      FINANCIAL: 'required',
      RISK: 'optional',
      COMPLIANCE: 'optional',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'not-applicable',
      AMENDMENTS: 'optional',
      CONTACTS: 'required',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['item_specifications', 'quantities', 'delivery_requirements', 'submission_deadline'],
    financialFields: ['budget_estimate', 'quantity_breaks'],
    riskCategories: ['specification_clarity', 'vendor_capability'],
    keyTermsToExtract: ['RFQ', 'Specifications', 'Quantity', 'Delivery', 'Deadline'],
    extractionHints: 'Extract item specifications, quantities, and submission requirements.',
    mandatoryFields: ['specifications', 'quantities', 'deliveryRequirements', 'deadline'],
    expectedSections: ['Specifications', 'Quantities', 'Delivery', 'Submission'],
  },

  NON_COMPETE: {
    displayName: 'Non-Compete Agreement',
    description: 'Agreement restricting competitive activities',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'not-applicable',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['restricted_activities', 'geographic_scope', 'duration', 'consideration', 'enforcement'],
    financialFields: ['consideration_amount'],
    riskCategories: ['enforceability', 'scope_overbroad', 'geographic_limitations'],
    keyTermsToExtract: ['Non-Compete', 'Restricted', 'Geographic Area', 'Duration', 'Competition'],
    extractionHints: 'Extract restricted activities, geographic scope, and duration. Check enforceability considerations.',
    mandatoryFields: ['restrictedActivities', 'geographicScope', 'duration'],
    expectedSections: ['Restrictions', 'Geographic Scope', 'Duration', 'Consideration', 'Enforcement'],
  },

  NON_SOLICITATION: {
    displayName: 'Non-Solicitation Agreement',
    description: 'Agreement restricting solicitation of employees or customers',
    artifactRelevance: {
      OVERVIEW: 'required',
      CLAUSES: 'required',
      FINANCIAL: 'optional',
      RISK: 'required',
      COMPLIANCE: 'required',
      OBLIGATIONS: 'required',
      RENEWAL: 'not-applicable',
      NEGOTIATION_POINTS: 'required',
      AMENDMENTS: 'optional',
      CONTACTS: 'optional',
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
    },
    clauseCategories: ['prohibited_solicitation', 'covered_persons', 'duration', 'exceptions', 'enforcement'],
    financialFields: ['consideration_amount'],
    riskCategories: ['enforceability', 'scope_definition', 'exceptions_clarity'],
    keyTermsToExtract: ['Non-Solicitation', 'Employees', 'Customers', 'Solicit', 'Duration'],
    extractionHints: 'Extract who is covered, what is prohibited, and duration.',
    mandatoryFields: ['prohibitedSolicitation', 'coveredPersons', 'duration'],
    expectedSections: ['Prohibited Activities', 'Covered Persons', 'Duration', 'Exceptions'],
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
      PARTIES: 'required',
      TIMELINE: 'optional',
      DELIVERABLES: 'optional',
      EXECUTIVE_SUMMARY: 'required',
      RATES: 'not-applicable',
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
  
  // Transactional Documents
  PURCHASE_ORDER: ['purchase order', 'po number', 'order confirmation', 'buyer order', 'requisition', 'delivery date', 'ship to', 'bill to', 'order quantity', 'unit price', 'order total'],
  INVOICE: ['invoice', 'invoice number', 'billing statement', 'amount due', 'payment terms', 'due date', 'remit to', 'tax invoice', 'subtotal', 'total amount', 'bill of sale'],
  QUOTE: ['quote', 'quotation', 'price quote', 'proposal', 'estimate', 'quoted price', 'valid until', 'quote reference', 'pricing proposal', 'cost estimate'],
  PROPOSAL: ['proposal', 'business proposal', 'project proposal', 'technical proposal', 'commercial proposal', 'proposal submission', 'proposed solution', 'scope of proposal'],
  RECEIPT: ['receipt', 'payment receipt', 'sales receipt', 'acknowledgment of payment', 'received from', 'amount received', 'receipt number', 'cash receipt'],
  BILL_OF_LADING: ['bill of lading', 'bol', 'b/l', 'shipping document', 'carrier', 'shipper', 'consignee', 'port of loading', 'port of discharge', 'freight', 'cargo'],
  PACKING_LIST: ['packing list', 'packing slip', 'shipment contents', 'package details', 'carton', 'weight', 'dimensions', 'sku', 'item description'],
  DELIVERY_NOTE: ['delivery note', 'delivery receipt', 'proof of delivery', 'goods received', 'delivery confirmation', 'delivered to', 'delivery date'],
  
  // Compliance & Regulatory Documents
  DATA_PROCESSING_AGREEMENT: ['data processing agreement', 'dpa', 'data processor', 'data controller', 'gdpr', 'personal data', 'subprocessor', 'data protection', 'privacy compliance', 'data subject rights'],
  TERMS_OF_SERVICE: ['terms of service', 'terms and conditions', 'tos', 'user agreement', 'service terms', 'acceptable use', 'user conduct', 'account terms', 'subscription terms'],
  PRIVACY_POLICY: ['privacy policy', 'privacy notice', 'data collection', 'personal information', 'cookies', 'data retention', 'privacy rights', 'data sharing', 'opt out'],
  ACCEPTABLE_USE_POLICY: ['acceptable use policy', 'aup', 'acceptable use', 'prohibited uses', 'usage guidelines', 'content policy', 'network policy', 'system resources'],
  CODE_OF_CONDUCT: ['code of conduct', 'ethical guidelines', 'professional conduct', 'behavior standards', 'ethics policy', 'workplace conduct', 'business ethics'],
  CERTIFICATION: ['certification', 'certificate', 'compliance certificate', 'certified', 'attestation', 'compliance attestation', 'audit certificate', 'certification authority'],
  
  // Corporate Documents
  BOARD_RESOLUTION: ['board resolution', 'board of directors', 'resolved', 'hereby resolved', 'unanimous consent', 'corporate resolution', 'directors meeting', 'board approval'],
  MINUTES: ['meeting minutes', 'minutes of meeting', 'board minutes', 'shareholder minutes', 'proceedings', 'meeting notes', 'recorded minutes', 'annual meeting'],
  POWER_OF_ATTORNEY: ['power of attorney', 'poa', 'attorney-in-fact', 'principal', 'authorize', 'grant authority', 'legal authority', 'limited power', 'general power'],
  CORPORATE_GUARANTEE: ['corporate guarantee', 'guarantee', 'guarantor', 'guaranteed obligations', 'unconditional guarantee', 'irrevocable guarantee', 'parent guarantee', 'performance guarantee'],
  LETTER_OF_CREDIT: ['letter of credit', 'l/c', 'lc', 'documentary credit', 'beneficiary', 'issuing bank', 'confirming bank', 'sight credit', 'usance credit', 'standby letter'],
  
  // Project & Work Documents
  WORK_ORDER: ['work order', 'work authorization', 'service order', 'job order', 'work ticket', 'field service', 'work request', 'maintenance order', 'repair order'],
  CHANGE_ORDER: ['change order', 'change request', 'contract change', 'scope change', 'change directive', 'variation order', 'modification order', 'change notice'],
  REQUEST_FOR_PROPOSAL: ['request for proposal', 'rfp', 'proposal request', 'invitation to bid', 'procurement', 'tender', 'bidding', 'evaluation criteria'],
  REQUEST_FOR_QUOTE: ['request for quote', 'rfq', 'request for quotation', 'price request', 'quote request', 'vendor quote', 'supplier quote'],
  SCOPE_CHANGE: ['scope change', 'scope modification', 'scope amendment', 'project scope', 'scope adjustment', 'revised scope', 'scope document'],
  PROJECT_CHARTER: ['project charter', 'project initiation', 'project authorization', 'project scope', 'project objectives', 'stakeholders', 'project sponsor', 'project manager'],
  
  // HR & Personnel Documents
  OFFER_LETTER: ['offer letter', 'employment offer', 'job offer', 'compensation', 'start date', 'position offered', 'offer of employment', 'signing bonus', 'conditional offer'],
  SEPARATION_AGREEMENT: ['separation agreement', 'termination agreement', 'severance', 'release of claims', 'separation payment', 'exit agreement', 'mutual separation', 'severance pay'],
  INDEPENDENT_CONTRACTOR: ['independent contractor', 'contractor agreement', '1099', 'self-employed', 'contractor services', 'independent services', 'freelance', 'consultant'],
  NON_COMPETE: ['non-compete', 'non-competition', 'covenant not to compete', 'competitive restriction', 'restricted activities', 'competing business', 'restricted territory'],
  NON_SOLICITATION: ['non-solicitation', 'non-solicit', 'no solicitation', 'employee solicitation', 'customer solicitation', 'restricted solicitation', 'hiring restriction'],
  
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
    
    // Get list of available contract types for the AI, grouped by category for better understanding
    const contractTypesByCategory = {
      'Employment & HR': ['EMPLOYMENT', 'OFFER_LETTER', 'SEPARATION_AGREEMENT', 'INDEPENDENT_CONTRACTOR', 'NON_COMPETE', 'NON_SOLICITATION'],
      'Transactional Documents': ['PURCHASE_ORDER', 'INVOICE', 'QUOTE', 'PROPOSAL', 'RECEIPT', 'BILL_OF_LADING', 'PACKING_LIST', 'DELIVERY_NOTE'],
      'Service & Work Agreements': ['MSA', 'SOW', 'CONSULTING', 'SERVICES', 'SLA', 'MAINTENANCE', 'WARRANTY', 'WORK_ORDER', 'CHANGE_ORDER'],
      'Intellectual Property': ['LICENSE', 'NDA', 'IP_ASSIGNMENT', 'TECHNOLOGY', 'ROYALTY'],
      'Sales & Supply': ['SALES', 'SUPPLY', 'DISTRIBUTION', 'RESELLER', 'MANUFACTURING', 'AGENCY', 'FRANCHISE'],
      'Financial': ['LOAN', 'INVESTMENT', 'LETTER_OF_CREDIT', 'CORPORATE_GUARANTEE'],
      'Real Estate & Construction': ['LEASE', 'REAL_ESTATE', 'CONSTRUCTION'],
      'Corporate & Governance': ['SHAREHOLDERS', 'OPERATING', 'JOINT_VENTURE', 'PARTNERSHIP', 'MERGER_ACQUISITION', 'BOARD_RESOLUTION', 'MINUTES', 'POWER_OF_ATTORNEY'],
      'Compliance & Legal': ['DATA_PROCESSING_AGREEMENT', 'TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'ACCEPTABLE_USE_POLICY', 'CODE_OF_CONDUCT', 'CERTIFICATION', 'SETTLEMENT'],
      'Project & Procurement': ['REQUEST_FOR_PROPOSAL', 'REQUEST_FOR_QUOTE', 'SCOPE_CHANGE', 'PROJECT_CHARTER'],
      'Contract Modifications': ['AMENDMENT', 'ADDENDUM', 'VARIATION', 'ENGAGEMENT_LETTER'],
      'Preliminary Agreements': ['MEMORANDUM_OF_UNDERSTANDING', 'LETTER_OF_INTENT'],
      'Other': ['SPONSORSHIP', 'INSURANCE', 'SUBSCRIPTION', 'OTHER']
    };
    
    // Prepare a sample of the text (first 4000 chars for better context)
    const textSample = text.slice(0, 4000);
    
    // Also analyze the beginning and specific sections for better detection
    const titleSection = text.slice(0, 500); // Often contains the document title
    const keywordAnalysis = detectContractTypeKeywords(text); // Get keyword hints
    
    const prompt = `You are an expert document classifier. Analyze this document and determine its precise type.

DOCUMENT TEXT:
"""
${textSample}
"""

TITLE/HEADER SECTION:
"""
${titleSection}
"""

KEYWORD ANALYSIS HINT: The keyword matching suggests this might be a "${keywordAnalysis.type}" document with keywords: [${keywordAnalysis.matchedKeywords.slice(0, 10).join(', ')}]

AVAILABLE DOCUMENT TYPES BY CATEGORY:
${Object.entries(contractTypesByCategory).map(([category, types]) => 
  `${category}:\n${types.map(t => `  - ${t}: ${CONTRACT_TYPE_PROFILES[t as ContractType]?.displayName || t}`).join('\n')}`
).join('\n\n')}

CLASSIFICATION GUIDELINES:
1. CONTEXT OVER KEYWORDS: Consider the document's overall purpose, not just specific words
2. STRUCTURAL PATTERNS: Look at headings, sections, and document organization
3. INTENT: What is this document trying to accomplish legally/commercially?
4. PARTY RELATIONSHIPS: Who are the parties and what is their relationship?
5. SPECIFICITY: Choose the most specific type that fits (e.g., "PURCHASE_ORDER" over "SALES" for a PO)
6. HYBRID DOCUMENTS: If a document combines multiple types, choose the primary purpose
7. AMENDMENTS: Documents that modify another contract are "AMENDMENT" unless they're specifically a "CHANGE_ORDER" or "VARIATION"
8. TRANSACTIONAL: Invoices, POs, Receipts are NOT contracts - classify them as their document type

RESPOND WITH JSON:
{
  "type": "DOCUMENT_TYPE_KEY",
  "confidence": 0.85,
  "reasoning": "Explanation of why this type was chosen",
  "alternativeType": "SECOND_BEST_TYPE_OR_NULL",
  "alternativeConfidence": 0.15
}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert legal and business document classifier with deep knowledge of contract law, commercial documents, and business transactions. You understand the nuances between similar document types (e.g., MSA vs SOW, Purchase Order vs Sales Agreement, Amendment vs Addendum). Always consider the document's primary purpose and legal effect when classifying.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.05, // Very low temperature for consistency
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const result = JSON.parse(content);
    
    // Flatten contract types for validation
    const allContractTypes = Object.values(contractTypesByCategory).flat();
    
    // Validate the result
    if (!result.type || !allContractTypes.includes(result.type)) {
      // If AI returned invalid type, check if keyword analysis has a strong match
      if (keywordAnalysis.confidence > 0.6) {
        return convertKeywordResultToAIFormat(keywordAnalysis);
      }
      return convertKeywordResultToAIFormat(detectContractTypeKeywords(text));
    }

    // Calculate final confidence by combining AI confidence with keyword evidence
    let finalConfidence = result.confidence || 0.7;
    
    // Boost confidence if AI and keyword analysis agree
    if (keywordAnalysis.type === result.type) {
      finalConfidence = Math.min(0.98, finalConfidence + 0.1);
    }
    
    // Slight reduction if AI and keyword analysis disagree significantly
    if (keywordAnalysis.type !== result.type && keywordAnalysis.confidence > 0.5) {
      finalConfidence = Math.max(0.5, finalConfidence - 0.1);
    }
    
    return {
      type: result.type as ContractType,
      confidence: Math.min(1.0, Math.max(0.0, finalConfidence)),
      reasoning: result.reasoning || 'AI analysis based on document structure, context, and content',
      matchedKeywords: keywordAnalysis.matchedKeywords,
    };
    
  } catch {
    return convertKeywordResultToAIFormat(detectContractTypeKeywords(text));
  }
}

/**
 * Detect contract type from extracted text using enhanced keyword matching (fallback method)
 * Uses weighted scoring: title/header matches weighted higher, considers keyword specificity
 */
export function detectContractTypeKeywords(text: string): { type: ContractType; confidence: number; matchedKeywords: string[] } {
  const lowercaseText = text.toLowerCase();
  const titleSection = text.slice(0, 500).toLowerCase(); // Title/header section
  const scores: { type: ContractType; score: number; matchedKeywords: string[]; titleMatch: boolean }[] = [];

  // Define high-value keywords that strongly indicate specific document types
  const strongIndicators: Record<string, ContractType> = {
    'purchase order': 'PURCHASE_ORDER',
    'invoice': 'INVOICE',
    'quotation': 'QUOTE',
    'statement of work': 'SOW',
    'master services agreement': 'MSA',
    'master service agreement': 'MSA',
    'non-disclosure agreement': 'NDA',
    'confidentiality agreement': 'NDA',
    'employment agreement': 'EMPLOYMENT',
    'offer letter': 'OFFER_LETTER',
    'consulting agreement': 'CONSULTING',
    'software license': 'LICENSE',
    'lease agreement': 'LEASE',
    'service level agreement': 'SLA',
    'data processing agreement': 'DATA_PROCESSING_AGREEMENT',
    'terms of service': 'TERMS_OF_SERVICE',
    'privacy policy': 'PRIVACY_POLICY',
    'board resolution': 'BOARD_RESOLUTION',
    'power of attorney': 'POWER_OF_ATTORNEY',
    'bill of lading': 'BILL_OF_LADING',
    'work order': 'WORK_ORDER',
    'change order': 'CHANGE_ORDER',
    'request for proposal': 'REQUEST_FOR_PROPOSAL',
    'rfp': 'REQUEST_FOR_PROPOSAL',
    'memorandum of understanding': 'MEMORANDUM_OF_UNDERSTANDING',
    'mou': 'MEMORANDUM_OF_UNDERSTANDING',
    'letter of intent': 'LETTER_OF_INTENT',
    'loi': 'LETTER_OF_INTENT',
    'separation agreement': 'SEPARATION_AGREEMENT',
    'independent contractor': 'INDEPENDENT_CONTRACTOR',
  };

  // Check for strong indicators in title section first
  for (const [indicator, type] of Object.entries(strongIndicators)) {
    if (titleSection.includes(indicator)) {
      const allKeywords = CONTRACT_TYPE_KEYWORDS[type] || [];
      const matchedKeywords = allKeywords.filter(keyword => lowercaseText.includes(keyword.toLowerCase()));
      return {
        type,
        confidence: 0.9,
        matchedKeywords: [indicator, ...matchedKeywords.filter(k => k !== indicator)].slice(0, 10),
      };
    }
  }

  for (const [type, keywords] of Object.entries(CONTRACT_TYPE_KEYWORDS) as [ContractType, string[]][]) {
    if (type === 'OTHER') continue;
    
    const matchedKeywords: string[] = [];
    let score = 0;
    let titleMatch = false;
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const inTitle = titleSection.includes(keywordLower);
      const inBody = lowercaseText.includes(keywordLower);
      
      if (inTitle) {
        // Title matches are weighted 3x
        score += 3;
        matchedKeywords.push(keyword);
        titleMatch = true;
      } else if (inBody) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }
    
    // Normalize score by keyword count but factor in total matches
    const normalizedScore = (score / (keywords.length * 3)) * (1 + Math.log(matchedKeywords.length + 1) / 10);
    
    if (matchedKeywords.length > 0) {
      scores.push({ type, score: normalizedScore, matchedKeywords, titleMatch });
    }
  }

  // Sort by score descending, then by title match
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.titleMatch !== b.titleMatch) return a.titleMatch ? -1 : 1;
    return b.matchedKeywords.length - a.matchedKeywords.length;
  });

  const topScore = scores[0];
  if (scores.length === 0 || !topScore || topScore.score < 0.05) {
    return { type: 'OTHER', confidence: 0.3, matchedKeywords: [] };
  }

  // Check if there's a close second - reduces confidence if ambiguous
  const secondScore = scores[1];
  let confidence = Math.min(0.95, topScore.score + 0.3);
  
  if (secondScore && (secondScore.score / topScore.score) > 0.8) {
    // Close match - reduce confidence
    confidence = Math.max(0.5, confidence - 0.15);
  }
  
  // Boost confidence for title matches
  if (topScore.titleMatch) {
    confidence = Math.min(0.95, confidence + 0.1);
  }

  return {
    type: topScore.type,
    confidence,
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
  const insights: Partial<Record<ContractType, ReturnType<typeof getContractTypeInsights>>> = {
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
    // Transactional Documents
    PURCHASE_ORDER: {
      typicalDuration: 'One-time transaction',
      commonIssues: ['Delivery delays', 'Quantity discrepancies', 'Quality issues', 'Price disputes'],
      negotiationFocus: ['Delivery terms', 'Quality standards', 'Payment terms', 'Return policy'],
      industryBenchmarks: [
        { metric: 'Payment Terms', typical: 'Net 30-60' },
        { metric: 'Delivery Window', typical: '2-4 weeks' }
      ]
    },
    INVOICE: {
      typicalDuration: 'One-time payment',
      commonIssues: ['Payment disputes', 'Late fees', 'Incorrect amounts', 'Missing details'],
      negotiationFocus: ['Payment terms', 'Early payment discounts', 'Late fees'],
      industryBenchmarks: [
        { metric: 'Payment Terms', typical: 'Net 30' },
        { metric: 'Late Fee', typical: '1.5% per month' }
      ]
    },
    QUOTE: {
      typicalDuration: 'Valid for 30-90 days',
      commonIssues: ['Scope ambiguity', 'Price validity', 'Hidden charges', 'Specification gaps'],
      negotiationFocus: ['Price components', 'Validity period', 'Scope clarity'],
      industryBenchmarks: [
        { metric: 'Validity Period', typical: '30-60 days' },
        { metric: 'Binding Status', typical: 'Non-binding until PO' }
      ]
    },
    PROPOSAL: {
      typicalDuration: 'Valid for 30-90 days',
      commonIssues: ['Scope creep', 'Timeline ambiguity', 'Hidden assumptions', 'Resource commitments'],
      negotiationFocus: ['Scope definition', 'Pricing model', 'Timeline', 'Assumptions'],
      industryBenchmarks: [
        { metric: 'Response Timeline', typical: '2-4 weeks' },
        { metric: 'Validity Period', typical: '60-90 days' }
      ]
    },
    RECEIPT: {
      typicalDuration: 'Proof of payment',
      commonIssues: ['Missing information', 'Incorrect amounts', 'Duplicate receipts'],
      negotiationFocus: ['Itemization', 'Tax information', 'Return period'],
      industryBenchmarks: [
        { metric: 'Return Period', typical: '30 days' }
      ]
    },
    BILL_OF_LADING: {
      typicalDuration: 'Transit period',
      commonIssues: ['Cargo damage', 'Delivery delays', 'Documentation errors', 'Liability disputes'],
      negotiationFocus: ['Liability limits', 'Delivery terms', 'Insurance coverage'],
      industryBenchmarks: [
        { metric: 'Carrier Liability', typical: 'Per Hague-Visby Rules' },
        { metric: 'Notice Period', typical: '3 days for apparent damage' }
      ]
    },
    PACKING_LIST: {
      typicalDuration: 'Shipment documentation',
      commonIssues: ['Missing items', 'Incorrect quantities', 'Weight discrepancies'],
      negotiationFocus: ['Accuracy requirements', 'Verification process'],
      industryBenchmarks: [
        { metric: 'Accuracy', typical: '99%+ expected' }
      ]
    },
    DELIVERY_NOTE: {
      typicalDuration: 'Proof of delivery',
      commonIssues: ['Missing signatures', 'Condition disputes', 'Time of delivery'],
      negotiationFocus: ['Acceptance criteria', 'Inspection period'],
      industryBenchmarks: [
        { metric: 'Inspection Period', typical: '24-48 hours' }
      ]
    },
    // Compliance Documents
    DATA_PROCESSING_AGREEMENT: {
      typicalDuration: 'Matches main agreement',
      commonIssues: ['Subprocessor approval', 'Data transfer mechanisms', 'Breach notification', 'Audit rights'],
      negotiationFocus: ['Subprocessor consent', 'SCCs inclusion', 'Notification timeline', 'Audit scope'],
      industryBenchmarks: [
        { metric: 'Breach Notification', typical: '72 hours (GDPR)' },
        { metric: 'Audit Frequency', typical: 'Annual' }
      ]
    },
    TERMS_OF_SERVICE: {
      typicalDuration: 'Ongoing until termination',
      commonIssues: ['Unilateral changes', 'Liability exclusions', 'Arbitration clauses', 'Data use'],
      negotiationFocus: ['Change notification', 'Liability limits', 'Dispute resolution', 'Data rights'],
      industryBenchmarks: [
        { metric: 'Change Notice', typical: '30 days' },
        { metric: 'Account Termination Notice', typical: '30 days' }
      ]
    },
    PRIVACY_POLICY: {
      typicalDuration: 'Ongoing',
      commonIssues: ['Data collection scope', 'Third-party sharing', 'Opt-out mechanisms', 'Data retention'],
      negotiationFocus: ['Collection limits', 'Sharing restrictions', 'User rights', 'Retention periods'],
      industryBenchmarks: [
        { metric: 'Policy Update Notice', typical: '30 days' },
        { metric: 'Data Access Response', typical: '30 days (GDPR)' }
      ]
    },
    ACCEPTABLE_USE_POLICY: {
      typicalDuration: 'Matches service agreement',
      commonIssues: ['Vague prohibited uses', 'Enforcement consistency', 'Appeal process'],
      negotiationFocus: ['Clear prohibitions', 'Violation consequences', 'Appeal rights'],
      industryBenchmarks: [
        { metric: 'Warning Before Termination', typical: 'At least 1 warning for minor violations' }
      ]
    },
    CODE_OF_CONDUCT: {
      typicalDuration: 'Ongoing employment/relationship',
      commonIssues: ['Vague standards', 'Inconsistent enforcement', 'Reporting mechanisms'],
      negotiationFocus: ['Clear expectations', 'Reporting channels', 'Consequence framework'],
      industryBenchmarks: [
        { metric: 'Training Frequency', typical: 'Annual' }
      ]
    },
    CERTIFICATION: {
      typicalDuration: '1-3 years renewable',
      commonIssues: ['Compliance maintenance', 'Renewal requirements', 'Scope limitations'],
      negotiationFocus: ['Scope coverage', 'Renewal terms', 'Audit requirements'],
      industryBenchmarks: [
        { metric: 'Renewal Period', typical: 'Annual or triennial' }
      ]
    },
    // Corporate Documents
    BOARD_RESOLUTION: {
      typicalDuration: 'Until superseded',
      commonIssues: ['Quorum issues', 'Authorization scope', 'Conflict of interest'],
      negotiationFocus: ['Clear authorization', 'Voting records', 'Effective date'],
      industryBenchmarks: [
        { metric: 'Quorum', typical: 'Majority of directors' }
      ]
    },
    MINUTES: {
      typicalDuration: 'Permanent record',
      commonIssues: ['Incomplete records', 'Approval delays', 'Missing attendees'],
      negotiationFocus: ['Accuracy', 'Approval process', 'Distribution'],
      industryBenchmarks: [
        { metric: 'Distribution Timeline', typical: 'Within 10 business days' }
      ]
    },
    POWER_OF_ATTORNEY: {
      typicalDuration: 'Specified or until revoked',
      commonIssues: ['Scope overreach', 'Revocation issues', 'Third-party acceptance'],
      negotiationFocus: ['Scope limitations', 'Duration', 'Revocation process'],
      industryBenchmarks: [
        { metric: 'Notarization', typical: 'Required for real estate transactions' }
      ]
    },
    CORPORATE_GUARANTEE: {
      typicalDuration: 'Matches underlying obligation',
      commonIssues: ['Scope of guarantee', 'Release conditions', 'Subrogation rights'],
      negotiationFocus: ['Guarantee cap', 'Release triggers', 'Notice requirements'],
      industryBenchmarks: [
        { metric: 'Common Use', typical: 'Parent guarantees for subsidiaries' }
      ]
    },
    LETTER_OF_CREDIT: {
      typicalDuration: '30 days to 1 year',
      commonIssues: ['Document discrepancies', 'Expiry management', 'Amendment delays'],
      negotiationFocus: ['Terms and conditions', 'Required documents', 'Amendment process'],
      industryBenchmarks: [
        { metric: 'Sight vs Usance', typical: 'Sight for most commercial transactions' },
        { metric: 'Confirmation', typical: 'Recommended for emerging markets' }
      ]
    },
    // Project Documents
    WORK_ORDER: {
      typicalDuration: 'Task-based (days to weeks)',
      commonIssues: ['Scope creep', 'Pricing disputes', 'Completion criteria'],
      negotiationFocus: ['Clear scope', 'Fixed vs T&M pricing', 'Acceptance criteria'],
      industryBenchmarks: [
        { metric: 'Approval Timeline', typical: 'Within 24-48 hours' }
      ]
    },
    CHANGE_ORDER: {
      typicalDuration: 'Matches project timeline',
      commonIssues: ['Cost disputes', 'Timeline impact', 'Approval delays'],
      negotiationFocus: ['Cost justification', 'Timeline adjustment', 'Impact assessment'],
      industryBenchmarks: [
        { metric: 'Approval Process', typical: 'Written approval required before work' }
      ]
    },
    REQUEST_FOR_PROPOSAL: {
      typicalDuration: '30-90 day response period',
      commonIssues: ['Unclear requirements', 'Unrealistic timelines', 'Evaluation bias'],
      negotiationFocus: ['Evaluation criteria', 'Timeline', 'Specification clarity'],
      industryBenchmarks: [
        { metric: 'Response Period', typical: '3-6 weeks' },
        { metric: 'Q&A Period', typical: '1-2 weeks' }
      ]
    },
    REQUEST_FOR_QUOTE: {
      typicalDuration: '7-30 day response period',
      commonIssues: ['Incomplete specifications', 'Price validity', 'Hidden costs'],
      negotiationFocus: ['Specification clarity', 'Price components', 'Delivery terms'],
      industryBenchmarks: [
        { metric: 'Response Period', typical: '1-2 weeks' },
        { metric: 'Quote Validity', typical: '30-60 days' }
      ]
    },
    SCOPE_CHANGE: {
      typicalDuration: 'Matches project timeline',
      commonIssues: ['Budget impact', 'Timeline delays', 'Resource constraints'],
      negotiationFocus: ['Impact assessment', 'Cost adjustment', 'Timeline revision'],
      industryBenchmarks: [
        { metric: 'Approval Required', typical: 'For changes >10% of budget' }
      ]
    },
    PROJECT_CHARTER: {
      typicalDuration: 'Project lifecycle',
      commonIssues: ['Scope ambiguity', 'Authority gaps', 'Resource commitment'],
      negotiationFocus: ['Objectives', 'Authority levels', 'Success criteria'],
      industryBenchmarks: [
        { metric: 'Approval', typical: 'Executive sponsor sign-off' }
      ]
    },
    // HR Documents
    OFFER_LETTER: {
      typicalDuration: 'Valid for acceptance period',
      commonIssues: ['Conditional terms', 'Start date flexibility', 'Benefit details'],
      negotiationFocus: ['Compensation', 'Start date', 'Sign-on bonus', 'Benefits'],
      industryBenchmarks: [
        { metric: 'Acceptance Period', typical: '7-14 days' },
        { metric: 'Counter-offer Rate', typical: '30-50%' }
      ]
    },
    SEPARATION_AGREEMENT: {
      typicalDuration: 'One-time with ongoing obligations',
      commonIssues: ['Release scope', 'Consideration adequacy', 'Non-disparagement scope'],
      negotiationFocus: ['Severance amount', 'Release language', 'References', 'Benefits continuation'],
      industryBenchmarks: [
        { metric: 'Severance', typical: '1-2 weeks per year of service' },
        { metric: 'Review Period', typical: '21 days (40+ years old: 21 days minimum)' }
      ]
    },
    INDEPENDENT_CONTRACTOR: {
      typicalDuration: 'Project or term-based',
      commonIssues: ['Misclassification risk', 'Control issues', 'IP ownership', 'Benefits exclusion'],
      negotiationFocus: ['Work arrangements', 'IP assignment', 'Termination terms', 'Insurance'],
      industryBenchmarks: [
        { metric: 'IRS Classification', typical: 'Must pass ABC test' },
        { metric: 'Payment Terms', typical: 'Net 30 on invoice' }
      ]
    },
    NON_COMPETE: {
      typicalDuration: '6-24 months post-employment',
      commonIssues: ['Enforceability', 'Geographic scope', 'Industry restrictions', 'Consideration'],
      negotiationFocus: ['Duration', 'Geographic limits', 'Industry scope', 'Carve-outs'],
      industryBenchmarks: [
        { metric: 'Duration', typical: '6-12 months' },
        { metric: 'Geographic Scope', typical: 'Reasonable based on business footprint' }
      ]
    },
    NON_SOLICITATION: {
      typicalDuration: '12-24 months post-employment',
      commonIssues: ['Definition of solicitation', 'Customer scope', 'Employee scope'],
      negotiationFocus: ['Covered relationships', 'Duration', 'Definition of solicitation'],
      industryBenchmarks: [
        { metric: 'Duration', typical: '12-18 months' },
        { metric: 'Scope', typical: 'Customers/employees worked with in last 12-24 months' }
      ]
    },
    OTHER: {
      typicalDuration: 'Varies',
      commonIssues: ['Unclear terms', 'Missing standard protections'],
      negotiationFocus: ['Core obligations', 'Term and termination', 'Liability'],
      industryBenchmarks: []
    }
  };
  
  const result = insights[type] || insights.OTHER;
  return result!;
}
