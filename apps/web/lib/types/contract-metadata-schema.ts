/**
 * Contract Metadata Schema
 * 
 * Comprehensive metadata fields for contracts based on enterprise CLM requirements.
 * These fields are designed for AI extraction with confidence gating and user verification.
 */

// ============ ENUMS ============

export type PaymentType = 
  | 'none' 
  | 'fixed_price' 
  | 'time_and_material' 
  | 'milestone' 
  | 'subscription' 
  | 'retainer' 
  | 'other';

export type BillingFrequencyType = 
  | 'one_off' 
  | 'recurring' 
  | 'mixed' 
  | 'none';

export type Periodicity = 
  | 'weekly' 
  | 'monthly' 
  | 'quarterly' 
  | 'semi_annual' 
  | 'annual' 
  | 'on_delivery' 
  | 'on_milestone' 
  | 'none' 
  | 'other';

export type UIAttention = 'none' | 'warning' | 'error' | 'info';

export type SignatureStatus = 
  | 'signed'
  | 'partially_signed'
  | 'unsigned'
  | 'unknown';

/**
 * Document classification - distinguishes actual contracts from non-binding documents
 */
export type DocumentClassification =
  | 'contract'           // Binding legal agreement
  | 'purchase_order'     // PO - typically one-sided, may reference a contract
  | 'invoice'            // Billing document, not a contract
  | 'quote'              // Price quote, non-binding
  | 'proposal'           // Business proposal, non-binding
  | 'work_order'         // Task assignment, may or may not be binding
  | 'letter_of_intent'   // LOI - typically non-binding
  | 'memorandum'         // MoU or internal memo
  | 'amendment'          // Contract modification (still a contract type)
  | 'addendum'           // Contract addition (still a contract type)
  | 'unknown';

// ============ EXTERNAL PARTY ============

export interface ExternalParty {
  id?: string;
  legalName: string;
  legalForm?: string; // e.g., "LLC", "Inc.", "GmbH", "AG"
  registeredAddress?: string;
  registeredSeat?: string; // City/Country of registration
  role?: string; // e.g., "Supplier", "Client", "Service Provider"
  contactName?: string;
  contactEmail?: string;
}

// ============ USER REFERENCE ============

export interface UserReference {
  userId: string;
  name?: string;
  email?: string;
}

// ============ ACCESS GROUP ============

export interface AccessGroup {
  id: string;
  name: string;
}

// ============ FIELD METADATA ============

export interface FieldConfidence {
  value: number; // 0-1
  source: 'ai_extraction' | 'user_input' | 'system_generated' | 'derived';
  extractedFrom?: string; // e.g., "Signature block", "Clause 5.2"
  needsVerification: boolean;
  message?: string;
}

// ============ MAIN CONTRACT METADATA SCHEMA ============

export interface ContractMetadataSchema {
  // ====== IDENTIFICATION ======
  
  /** System-generated unique document number */
  document_number: string;
  
  /** Official document title - extracted or generated */
  document_title: string;
  
  /** Source of the title: 'extracted' or 'generated' */
  title_source?: 'extracted' | 'generated';
  
  /** Document classification - contract vs PO/invoice/quote etc. */
  document_classification: DocumentClassification;
  
  /** Confidence score for document classification (0-1) */
  document_classification_confidence?: number;
  
  /** Warning message if document is not a proper contract */
  document_classification_warning?: string;
  
  /** 1-2 sentence purpose summary */
  contract_short_description: string;
  
  /** Governing jurisdiction (ISO 3166-1 alpha-2 or name) */
  jurisdiction: string;
  
  /** Contract language (ISO 639-1 or name) */
  contract_language: string;

  // ====== EXTERNAL PARTIES ======
  
  /** All external contracting parties */
  external_parties: ExternalParty[];

  // ====== COMMERCIALS / FINANCIALS ======
  
  /** Total Contract Value - only if calculable with certainty */
  tcv_amount: number;
  
  /** Explanation of pricing model and TCV calculation */
  tcv_text?: string;
  
  /** Classification of payment type */
  payment_type: PaymentType;
  
  /** One-off, recurring, mixed, or none */
  billing_frequency_type: BillingFrequencyType;
  
  /** Invoice/payment periodicity */
  periodicity: Periodicity;
  
  /** Primary contract currency (ISO 4217) */
  currency: string;

  // ====== DATES ======
  
  /** Date of the last signature (final execution date) */
  signature_date?: string | null;
  
  /** Signature status - whether contract is signed, partially signed, or unsigned */
  signature_status: SignatureStatus;
  
  /** Flag indicating contract requires signature attention */
  signature_required_flag: boolean;
  
  /** Effective/commencement date */
  start_date: string;
  
  /** Expiration/end date (null if evergreen) */
  end_date?: string | null;
  
  /** Earliest explicit termination date if present */
  termination_date?: string | null;

  // ====== REMINDERS & NOTICES ======
  
  /** Whether deadline reminders are enabled */
  reminder_enabled: boolean;
  
  /** Days before end date to trigger reminder */
  reminder_days_before_end: number;
  
  /** Notice period with original wording and unit */
  notice_period: string;
  
  /** Normalized notice period in days (derived) */
  notice_period_days?: number;

  // ====== OWNERSHIP & ACCESS ======
  
  /** User who created/uploaded the contract */
  created_by_user_id: string;
  
  /** Contract owner(s) - supports multiple */
  contract_owner_user_ids: string[];
  
  /** Access groups for confidentiality/policy */
  access_group_ids: string[];

  // ====== FIELD CONFIDENCE TRACKING ======
  
  /** Confidence metadata for each field */
  _field_confidence?: Record<string, FieldConfidence>;
  
  /** Fields requiring user verification */
  _fields_needing_verification?: string[];
  
  /** Overall extraction confidence score */
  _extraction_confidence?: number;
  
  /** Timestamp of last AI extraction */
  _extracted_at?: string;
  
  /** Model used for extraction */
  _extraction_model?: string;
}

// ============ UI FIELD DEFINITION ============

export interface MetadataFieldDefinition {
  key: keyof ContractMetadataSchema;
  label: string;
  type: 'string' | 'decimal' | 'integer' | 'date' | 'boolean' | 'enum' | 'array_fk' | 'fk';
  required: boolean;
  editable: boolean;
  system_generated?: boolean;
  unique?: boolean;
  format?: string;
  enum?: string[];
  ref?: string;
  extraction_hint?: string;
  ui_attention: UIAttention;
  section: 'identification' | 'parties' | 'commercials' | 'dates' | 'reminders' | 'ownership';
  displayOrder: number;
}

// ============ FIELD DEFINITIONS FOR UI ============

export const CONTRACT_METADATA_FIELDS: MetadataFieldDefinition[] = [
  // IDENTIFICATION
  {
    key: 'document_number',
    label: 'Document Number',
    type: 'string',
    required: true,
    editable: false,
    system_generated: true,
    unique: true,
    ui_attention: 'none',
    section: 'identification',
    displayOrder: 1
  },
  {
    key: 'document_title',
    label: 'Document Title',
    type: 'string',
    required: true,
    editable: true,
    ui_attention: 'none',
    section: 'identification',
    displayOrder: 2
  },
  {
    key: 'contract_short_description',
    label: 'Short Description',
    type: 'string',
    required: true,
    editable: true,
    ui_attention: 'none',
    section: 'identification',
    displayOrder: 3
  },
  {
    key: 'jurisdiction',
    label: 'Jurisdiction',
    type: 'string',
    required: true,
    editable: true,
    format: 'ISO3166-1-alpha2_or_name',
    ui_attention: 'none',
    section: 'identification',
    displayOrder: 4
  },
  {
    key: 'contract_language',
    label: 'Contract Language',
    type: 'string',
    required: true,
    editable: true,
    format: 'ISO639-1_or_name',
    ui_attention: 'none',
    section: 'identification',
    displayOrder: 5
  },

  // PARTIES
  {
    key: 'external_parties',
    label: 'External Contracting Parties',
    type: 'array_fk',
    required: true,
    editable: true,
    ref: 'party',
    ui_attention: 'none',
    section: 'parties',
    displayOrder: 1
  },

  // COMMERCIALS
  {
    key: 'tcv_amount',
    label: 'Total Contract Value (TCV)',
    type: 'decimal',
    required: true,
    editable: true,
    ui_attention: 'none',
    section: 'commercials',
    displayOrder: 1
  },
  {
    key: 'tcv_text',
    label: 'TCV Explanation',
    type: 'string',
    required: false,
    editable: true,
    ui_attention: 'none',
    section: 'commercials',
    displayOrder: 2
  },
  {
    key: 'payment_type',
    label: 'Payment Type',
    type: 'enum',
    required: true,
    editable: true,
    enum: ['none', 'fixed_price', 'time_and_material', 'milestone', 'subscription', 'retainer', 'other'],
    ui_attention: 'none',
    section: 'commercials',
    displayOrder: 3
  },
  {
    key: 'billing_frequency_type',
    label: 'Billing Frequency',
    type: 'enum',
    required: true,
    editable: true,
    enum: ['one_off', 'recurring', 'mixed', 'none'],
    ui_attention: 'none',
    section: 'commercials',
    displayOrder: 4
  },
  {
    key: 'periodicity',
    label: 'Payment Periodicity',
    type: 'enum',
    required: true,
    editable: true,
    enum: ['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'on_delivery', 'on_milestone', 'none', 'other'],
    ui_attention: 'none',
    section: 'commercials',
    displayOrder: 5
  },
  {
    key: 'currency',
    label: 'Currency',
    type: 'string',
    required: true,
    editable: true,
    format: 'ISO4217',
    ui_attention: 'warning',
    section: 'commercials',
    displayOrder: 6
  },

  // DATES
  {
    key: 'signature_date',
    label: 'Signature Date',
    type: 'date',
    required: false,
    editable: true,
    ui_attention: 'warning',
    section: 'dates',
    displayOrder: 1
  },
  {
    key: 'signature_status',
    label: 'Signature Status',
    type: 'enum',
    required: true,
    editable: true,
    enum: ['signed', 'partially_signed', 'unsigned', 'unknown'],
    extraction_hint: 'Check for signature blocks, executed signatures, or "duly executed" language. Look for dates near signatures and witness attestations.',
    ui_attention: 'warning',
    section: 'dates',
    displayOrder: 2
  },
  {
    key: 'signature_required_flag',
    label: 'Signature Attention Required',
    type: 'boolean',
    required: false,
    editable: true,
    system_generated: true,
    ui_attention: 'error',
    section: 'dates',
    displayOrder: 3
  },
  {
    key: 'start_date',
    label: 'Start Date (Effective)',
    type: 'date',
    required: true,
    editable: true,
    ui_attention: 'none',
    section: 'dates',
    displayOrder: 2
  },
  {
    key: 'end_date',
    label: 'End Date',
    type: 'date',
    required: false,
    editable: true,
    ui_attention: 'none',
    section: 'dates',
    displayOrder: 3
  },
  {
    key: 'termination_date',
    label: 'Termination Date',
    type: 'date',
    required: false,
    editable: true,
    ui_attention: 'none',
    section: 'dates',
    displayOrder: 4
  },

  // REMINDERS
  {
    key: 'reminder_enabled',
    label: 'Enable Reminders',
    type: 'boolean',
    required: true,
    editable: true,
    ui_attention: 'none',
    section: 'reminders',
    displayOrder: 1
  },
  {
    key: 'reminder_days_before_end',
    label: 'Reminder Lead Time (Days)',
    type: 'integer',
    required: true,
    editable: true,
    ui_attention: 'warning',
    section: 'reminders',
    displayOrder: 2
  },
  {
    key: 'notice_period',
    label: 'Notice Period',
    type: 'string',
    required: true,
    editable: true,
    ui_attention: 'none',
    section: 'reminders',
    displayOrder: 3
  },

  // OWNERSHIP
  {
    key: 'created_by_user_id',
    label: 'Created By',
    type: 'fk',
    required: true,
    editable: false,
    system_generated: true,
    ref: 'user',
    ui_attention: 'none',
    section: 'ownership',
    displayOrder: 1
  },
  {
    key: 'contract_owner_user_ids',
    label: 'Contract Owner(s)',
    type: 'array_fk',
    required: true,
    editable: true,
    ref: 'user',
    ui_attention: 'warning',
    section: 'ownership',
    displayOrder: 2
  },
  {
    key: 'access_group_ids',
    label: 'Access Groups',
    type: 'array_fk',
    required: true,
    editable: true,
    ref: 'access_group',
    ui_attention: 'warning',
    section: 'ownership',
    displayOrder: 3
  }
];

// ============ HELPER FUNCTIONS ============

export function getDefaultContractMetadata(): Partial<ContractMetadataSchema> {
  return {
    document_number: '',
    document_title: '',
    contract_short_description: '',
    jurisdiction: '',
    contract_language: 'en',
    external_parties: [],
    tcv_amount: 0,
    tcv_text: '',
    payment_type: 'none',
    billing_frequency_type: 'none',
    periodicity: 'none',
    currency: 'USD',
    signature_date: null,
    signature_status: 'unknown',
    signature_required_flag: false,
    start_date: '',
    end_date: null,
    termination_date: null,
    reminder_enabled: true,
    reminder_days_before_end: 60,
    notice_period: '',
    created_by_user_id: '',
    contract_owner_user_ids: [],
    access_group_ids: [],
    _fields_needing_verification: [],
    _extraction_confidence: 0
  };
}

export function getFieldsBySection(section: MetadataFieldDefinition['section']): MetadataFieldDefinition[] {
  return CONTRACT_METADATA_FIELDS
    .filter(f => f.section === section)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getFieldsNeedingAttention(metadata: Partial<ContractMetadataSchema>): MetadataFieldDefinition[] {
  return CONTRACT_METADATA_FIELDS.filter(field => {
    if (field.ui_attention === 'none') return false;
    
    // Check if field needs verification based on confidence
    const confidence = metadata._field_confidence?.[field.key];
    if (confidence?.needsVerification) return true;
    
    // Check if required field is missing
    if (field.required) {
      const value = metadata[field.key];
      if (value === undefined || value === null || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        return true;
      }
    }
    
    return false;
  });
}

export function formatPaymentType(type: PaymentType): string {
  const labels: Record<PaymentType, string> = {
    none: 'No Payment',
    fixed_price: 'Fixed Price',
    time_and_material: 'Time & Material',
    milestone: 'Milestone-Based',
    subscription: 'Subscription',
    retainer: 'Retainer',
    other: 'Other'
  };
  return labels[type] || type;
}

export function formatBillingFrequency(type: BillingFrequencyType): string {
  const labels: Record<BillingFrequencyType, string> = {
    one_off: 'One-Off Payment',
    recurring: 'Recurring',
    mixed: 'Mixed',
    none: 'No Billing'
  };
  return labels[type] || type;
}

export function formatPeriodicity(type: Periodicity): string {
  const labels: Record<Periodicity, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semi_annual: 'Semi-Annual',
    annual: 'Annual',
    on_delivery: 'On Delivery',
    on_milestone: 'On Milestone',
    none: 'N/A',
    other: 'Other'
  };
  return labels[type] || type;
}
