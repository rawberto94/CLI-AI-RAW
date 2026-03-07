/**
 * Contract Taxonomy Types
 * 
 * Comprehensive contract classification taxonomy with categories, subtypes,
 * document roles, and tag dimensions for enterprise contract management.
 * 
 * Based on industry-standard contract types and roles for CLM systems.
 */

// ============================================================================
// TAXONOMY VERSION & METADATA
// ============================================================================

export const TAXONOMY_VERSION = "1.0" as const;

// ============================================================================
// CONTRACT CATEGORIES
// ============================================================================

export type ContractCategoryId =
  | "master_framework"
  | "scope_work_authorization"
  | "purchase_supply"
  | "services_delivery"
  | "software_cloud"
  | "performance_operations"
  | "confidentiality_ip"
  | "data_security_privacy"
  | "commercial_finance"
  | "corporate_legal_changes";

export type DocumentRoleId =
  | "governing_agreement"
  | "execution_document"
  | "operational_appendix"
  | "compliance_attachment"
  | "commercial_attachment"
  | "modification"
  | "standalone_agreement";

export interface ContractCategory {
  id: ContractCategoryId;
  label: string;
  description: string;
  subtypes: string[];
  aliases: string[];
  default_role: DocumentRoleId;
  key_extractions: string[];
}

export interface DocumentRole {
  id: DocumentRoleId;
  label: string;
  description: string;
}

// ============================================================================
// TAG DIMENSIONS
// ============================================================================

export type PricingModel =
  | "fixed_fee"
  | "time_and_materials"
  | "subscription"
  | "milestone"
  | "unit_based"
  | "revenue_share";

export type DeliveryModel =
  | "consulting"
  | "managed_services"
  | "outsourcing_bpo"
  | "outsourcing_ito"
  | "staff_augmentation"
  | "software_saas"
  | "software_perpetual";

export type DataProfile =
  | "no_personal_data"
  | "personal_data"
  | "special_category_data"
  | "cross_border_transfer";

export type RiskFlag =
  | "auto_renewal"
  | "uncapped_liability"
  | "broad_indemnity"
  | "customer_unilateral_termination"
  | "audit_rights_broad"
  | "nonstandard_governing_law";

export interface TagDimension {
  id: "pricing_model" | "delivery_model" | "data_profile" | "risk_flags";
  values: string[];
}

// ============================================================================
// FULL TAXONOMY SCHEMA
// ============================================================================

export interface ContractTaxonomy {
  taxonomy_version: string;
  contract_categories: ContractCategory[];
  document_roles: DocumentRole[];
  tag_dimensions: TagDimension[];
}

// ============================================================================
// CONTRACT CLASSIFICATION RESULT
// ============================================================================

export interface ContractClassification {
  /** Primary category ID */
  category_id: ContractCategoryId;
  
  /** Specific subtype if identified */
  subtype?: string;
  
  /** Document role */
  role: DocumentRoleId;
  
  /** Confidence score 0-1 */
  confidence: number;
  
  /** Alternative classifications */
  alternatives?: Array<{
    category_id: ContractCategoryId;
    subtype?: string;
    confidence: number;
  }>;
  
  /** Detected aliases/identifiers */
  detected_aliases?: string[];
  
  /** Reasoning for classification */
  reasoning?: string;
  
  /** Timestamp of classification */
  classified_at: Date;
  
  /** Model/version used */
  classifier_version?: string;
}

// ============================================================================
// CONTRACT TAGS
// ============================================================================

export interface ContractTags {
  /** Pricing models detected */
  pricing_models?: PricingModel[];
  
  /** Delivery models detected */
  delivery_models?: DeliveryModel[];
  
  /** Data profile classification */
  data_profiles?: DataProfile[];
  
  /** Risk flags identified */
  risk_flags?: RiskFlag[];
}

// ============================================================================
// EXTENDED CONTRACT METADATA
// ============================================================================

export interface ExtendedContractMetadata {
  /** Primary classification */
  classification: ContractClassification;
  
  /** Tag-based metadata */
  tags: ContractTags;
  
  /** Key extracted fields based on category */
  extracted_fields?: Record<string, any>;
  
  /** Confidence metadata per field */
  field_confidence?: Record<string, {
    value: number;
    source: "ai_extraction" | "user_input" | "system_generated";
    needs_verification: boolean;
  }>;
}

// ============================================================================
// TAXONOMY DATA EXPORT
// ============================================================================

export const CONTRACT_TAXONOMY: ContractTaxonomy = {
  taxonomy_version: TAXONOMY_VERSION,
  
  contract_categories: [
    {
      id: "master_framework",
      label: "Master / Framework",
      description: "Governing terms that apply across multiple future orders/work (e.g., MSA, framework agreement, general terms).",
      subtypes: [
        "Master Services Agreement (MSA)",
        "Framework Agreement",
        "Master Agreement",
        "General Terms & Conditions (GTC)",
        "Master Purchase Agreement"
      ],
      aliases: ["MSA", "Framework", "Master Agreement", "GTC", "Terms and Conditions"],
      default_role: "governing_agreement",
      key_extractions: [
        "parties",
        "effective_date",
        "term",
        "renewal",
        "governing_law",
        "liability_cap",
        "indemnities",
        "ip_ownership",
        "confidentiality",
        "payment_terms"
      ]
    },
    {
      id: "scope_work_authorization",
      label: "Scope / Work Authorization",
      description: "Documents that authorize and define a specific scope, deliverables, timeline, acceptance, and commercials.",
      subtypes: [
        "Statement of Work (SOW)",
        "Work Order",
        "Task Order",
        "Change Order / Variation Order",
        "Order Form"
      ],
      aliases: ["SOW", "Work Order", "Task Order", "Change Request", "Change Order", "Order Form"],
      default_role: "execution_document",
      key_extractions: [
        "scope",
        "deliverables",
        "milestones",
        "acceptance",
        "fees",
        "payment_schedule",
        "sla_references",
        "term",
        "renewal",
        "dependencies",
        "assumptions"
      ]
    },
    {
      id: "purchase_supply",
      label: "Purchase / Supply",
      description: "Buying goods or supply chain relationships, including POs and supply agreements.",
      subtypes: [
        "Purchase Order (PO)",
        "Supply Agreement",
        "Manufacturing Agreement",
        "OEM Agreement",
        "Logistics / Transportation Agreement",
        "Warehousing Agreement",
        "Quality Agreement"
      ],
      aliases: ["PO", "Purchase Order", "Supply Contract", "OEM", "Quality Agreement"],
      default_role: "execution_document",
      key_extractions: [
        "items",
        "quantities",
        "unit_prices",
        "delivery_terms",
        "incoterms",
        "warranties",
        "returns",
        "payment_terms",
        "governing_law",
        "limitation_of_liability"
      ]
    },
    {
      id: "services_delivery",
      label: "Services Delivery",
      description: "Services agreements where delivery terms are central (consulting, managed services, outsourcing, staff aug).",
      subtypes: [
        "Professional Services Agreement (PSA)",
        "Consulting Agreement",
        "Managed Services Agreement",
        "Outsourcing Agreement (ITO/BPO)",
        "Staff Augmentation Agreement",
        "Independent Contractor Agreement"
      ],
      aliases: ["PSA", "Managed Services", "Outsourcing", "BPO Agreement", "ITO Agreement", "Staff Aug"],
      default_role: "execution_document",
      key_extractions: [
        "services",
        "fees",
        "rate_model",
        "staffing",
        "deliverables",
        "acceptance",
        "governance",
        "termination",
        "liability_cap",
        "indemnities"
      ]
    },
    {
      id: "software_cloud",
      label: "Software / Cloud",
      description: "Licensing/subscription/hosting agreements covering software, SaaS, cloud services, support and implementation.",
      subtypes: [
        "SaaS Subscription Agreement",
        "Software License Agreement",
        "Cloud Services Agreement",
        "Hosting Agreement",
        "Support & Maintenance Agreement",
        "Implementation / System Integration Agreement",
        "EULA (Enterprise)"
      ],
      aliases: ["SaaS", "Subscription", "Software License", "Cloud Agreement", "Hosting", "Maintenance"],
      default_role: "execution_document",
      key_extractions: [
        "license_grant",
        "usage_limits",
        "fees",
        "renewal",
        "support_terms",
        "sla_terms",
        "data_handling",
        "security_terms",
        "ip",
        "termination",
        "audit_rights"
      ]
    },
    {
      id: "performance_operations",
      label: "Performance / Operations",
      description: "Operational performance commitments (SLAs, KPIs, service credits) often attached to services/software.",
      subtypes: [
        "Service Level Agreement (SLA)",
        "KPI / Scorecard Agreement",
        "Service Credits Schedule",
        "Operational Runbook (Contractual Appendix)"
      ],
      aliases: ["SLA", "Service Credits", "KPI", "Scorecard"],
      default_role: "operational_appendix",
      key_extractions: [
        "availability",
        "response_times",
        "resolution_times",
        "service_credits",
        "exclusions",
        "reporting",
        "governance",
        "escalation"
      ]
    },
    {
      id: "confidentiality_ip",
      label: "Confidentiality / IP",
      description: "Agreements focused on confidentiality, IP ownership, and collaboration.",
      subtypes: [
        "Mutual NDA",
        "Unilateral NDA",
        "Confidentiality Agreement",
        "IP Assignment Agreement",
        "Joint Development Agreement",
        "Source Code Escrow Agreement"
      ],
      aliases: ["NDA", "Confidentiality", "IP Assignment", "JDA", "Escrow"],
      default_role: "standalone_agreement",
      key_extractions: [
        "confidential_info_definition",
        "use_restrictions",
        "term",
        "survival",
        "return_destroy",
        "remedies",
        "ip_ownership"
      ]
    },
    {
      id: "data_security_privacy",
      label: "Data / Security / Privacy",
      description: "Data protection and security obligations (GDPR, SCCs, security addenda).",
      subtypes: [
        "Data Processing Agreement/Addendum (DPA)",
        "Standard Contractual Clauses (SCCs)",
        "UK GDPR Addendum",
        "Data Sharing Agreement",
        "Security Addendum / Information Security Agreement",
        "Incident Response Addendum"
      ],
      aliases: ["DPA", "GDPR", "SCC", "Security Addendum", "Data Sharing"],
      default_role: "compliance_attachment",
      key_extractions: [
        "controller_processor",
        "processing_purpose",
        "data_categories",
        "subprocessors",
        "breach_notification",
        "transfers",
        "security_measures",
        "audit_rights",
        "retention_deletion"
      ]
    },
    {
      id: "commercial_finance",
      label: "Commercial / Finance",
      description: "Pricing, revenue share, commission, guarantees, settlements—often attached to a main agreement.",
      subtypes: [
        "Pricing Schedule / Rate Card Appendix",
        "Revenue Share Agreement",
        "Commission Agreement",
        "Guarantee / Parent Company Guarantee",
        "Settlement & Release Agreement",
        "Escrow Agreement (Financial)"
      ],
      aliases: ["Rate Card", "Pricing Schedule", "Revenue Share", "Commission", "Guarantee", "Settlement"],
      default_role: "commercial_attachment",
      key_extractions: [
        "fees",
        "discounts",
        "rebates",
        "payment_terms",
        "audit_rights",
        "caps_floors",
        "settlement_amount",
        "release_language"
      ]
    },
    {
      id: "corporate_legal_changes",
      label: "Corporate / Legal Changes",
      description: "Documents that modify or transfer contractual rights/obligations.",
      subtypes: [
        "Amendment",
        "Addendum",
        "Novation Agreement",
        "Assignment Agreement",
        "Side Letter",
        "Waiver"
      ],
      aliases: ["Amendment", "Addendum", "Novation", "Assignment", "Side Letter", "Waiver"],
      default_role: "modification",
      key_extractions: [
        "modified_sections",
        "effective_date",
        "supersedes_language",
        "consents",
        "party_changes",
        "signature_blocks"
      ]
    }
  ],
  
  document_roles: [
    {
      id: "governing_agreement",
      label: "Governing Agreement",
      description: "Sets baseline terms; other documents incorporate it by reference."
    },
    {
      id: "execution_document",
      label: "Execution Document",
      description: "Authorizes specific work/purchase/subscription under governing terms."
    },
    {
      id: "operational_appendix",
      label: "Operational Appendix",
      description: "Defines measurable performance/operational commitments (SLA/KPI/etc.)."
    },
    {
      id: "compliance_attachment",
      label: "Compliance Attachment",
      description: "Regulatory/security/data processing terms appended to a main contract."
    },
    {
      id: "commercial_attachment",
      label: "Commercial Attachment",
      description: "Pricing, rebates, credits, commissions, guarantees; often schedules/appendices."
    },
    {
      id: "modification",
      label: "Modification",
      description: "Changes or transfers rights/obligations of an existing agreement."
    },
    {
      id: "standalone_agreement",
      label: "Standalone Agreement",
      description: "Self-contained agreement not necessarily tied to an MSA (e.g., NDA)."
    }
  ],
  
  tag_dimensions: [
    {
      id: "pricing_model",
      values: ["fixed_fee", "time_and_materials", "subscription", "milestone", "unit_based", "revenue_share"]
    },
    {
      id: "delivery_model",
      values: ["consulting", "managed_services", "outsourcing_bpo", "outsourcing_ito", "staff_augmentation", "software_saas", "software_perpetual"]
    },
    {
      id: "data_profile",
      values: ["no_personal_data", "personal_data", "special_category_data", "cross_border_transfer"]
    },
    {
      id: "risk_flags",
      values: ["auto_renewal", "uncapped_liability", "broad_indemnity", "customer_unilateral_termination", "audit_rights_broad", "nonstandard_governing_law"]
    }
  ]
};
