/**
 * Contract Generation Types
 * Phase 1: Foundation for contract creation and S2P workflows
 */

// ====================
// TEMPLATE TYPES
// ====================

export type TemplateCategory =
  | 'MSA'           // Master Service Agreement
  | 'SOW'           // Statement of Work
  | 'NDA'           // Non-Disclosure Agreement
  | 'AMENDMENT'     // Contract Amendment
  | 'RENEWAL'       // Renewal Agreement
  | 'ORDER_FORM'    // Order Form
  | 'SLA'           // Service Level Agreement
  | 'DPA'           // Data Processing Agreement
  | 'SUBCONTRACT'   // Subcontractor Agreement
  | 'CONSULTING'    // Consulting Agreement
  | 'LICENSE'       // License Agreement
  | 'OTHER';

export interface TemplateVariable {
  id: string;
  name: string;
  displayName: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'select' | 'multiselect' | 'boolean' | 'party';
  required: boolean;
  defaultValue?: string | number | boolean | Date;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  placeholder?: string;
  helpText?: string;
  section?: string;
  order?: number;
}

export interface TemplateSection {
  id: string;
  name: string;
  title: string;
  order: number;
  clauses: string[]; // Clause IDs
  isRequired: boolean;
  isEditable: boolean;
}

export interface Template {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  subcategory?: string;
  
  // Content
  content: {
    sections: TemplateSection[];
    header?: string;
    footer?: string;
    watermark?: string;
  };
  variables: TemplateVariable[];
  defaultClauses: string[];
  
  // Metadata
  version: number;
  isActive: boolean;
  isPublic: boolean;
  thumbnail?: string;
  estimatedTime?: number; // Minutes to complete
  
  // Usage
  usageCount: number;
  lastUsedAt?: Date;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed
  tags?: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
}

// ====================
// CLAUSE LIBRARY TYPES
// ====================

export type ClauseCategory =
  | 'DEFINITIONS'
  | 'SCOPE'
  | 'TERM'
  | 'PAYMENT'
  | 'TERMINATION'
  | 'LIABILITY'
  | 'INDEMNIFICATION'
  | 'CONFIDENTIALITY'
  | 'IP_RIGHTS'
  | 'DATA_PROTECTION'
  | 'COMPLIANCE'
  | 'INSURANCE'
  | 'DISPUTE_RESOLUTION'
  | 'GOVERNING_LAW'
  | 'FORCE_MAJEURE'
  | 'ASSIGNMENT'
  | 'NOTICES'
  | 'AMENDMENTS'
  | 'SURVIVAL'
  | 'ENTIRE_AGREEMENT'
  | 'MISCELLANEOUS';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ClauseAlternative {
  id: string;
  name: string;
  content: string;
  riskDelta: number; // -2 to +2
  description?: string;
  useCase?: string;
}

export interface NegotiationPlaybook {
  preferredPosition: string;
  fallbackPositions: string[];
  walkAwayPoint: string;
  negotiationTips: string[];
  counterArguments: {
    objection: string;
    response: string;
  }[];
}

export interface LibraryClause {
  id: string;
  tenantId: string;
  
  // Basic Info
  name: string;
  title: string;
  category: ClauseCategory;
  subcategory?: string;
  
  // Content
  content: string;
  contentHtml?: string;
  variables?: TemplateVariable[];
  
  // Classification
  riskLevel: RiskLevel;
  isStandard: boolean;
  isMandatory: boolean;
  isNegotiable: boolean;
  
  // Alternatives & Guidance
  alternatives?: ClauseAlternative[];
  fallbackChain?: string[];
  guidance?: string;
  playbook?: NegotiationPlaybook;
  
  // Metadata
  tags: string[];
  usageCount: number;
  lastUsedAt?: Date;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ====================
// CONTRACT DRAFT TYPES
// ====================

export type DraftStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_SIGNATURE'
  | 'EXECUTED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type DraftSourceType =
  | 'NEW'
  | 'TEMPLATE'
  | 'RENEWAL'
  | 'AMENDMENT'
  | 'CLONE'
  | 'IMPORT';

export type ClauseStatus =
  | 'INCLUDED'
  | 'EXCLUDED'
  | 'PENDING_REVIEW'
  | 'NEGOTIATING'
  | 'AGREED'
  | 'REJECTED';

export interface PartyInfo {
  name: string;
  type: 'INTERNAL' | 'CLIENT' | 'SUPPLIER' | 'PARTNER';
  legalName?: string;
  address?: {
    street: string;
    city: string;
    state?: string;
    country: string;
    postalCode: string;
  };
  signatories: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  }[];
  contact?: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface DraftClause {
  id: string;
  draftId: string;
  clauseId?: string; // Reference to library
  
  // Content
  title: string;
  content: string;
  isModified: boolean;
  originalContent?: string;
  
  // Positioning
  sectionId?: string;
  order: number;
  
  // Status
  status: ClauseStatus;
  
  // Risk
  riskLevel: RiskLevel;
  riskNotes?: string;
  
  // Negotiation
  isNegotiated: boolean;
  negotiationHistory?: {
    version: number;
    content: string;
    modifiedBy: string;
    modifiedAt: Date;
    notes?: string;
  }[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractDraft {
  id: string;
  tenantId: string;
  
  // Basic Info
  title: string;
  type: TemplateCategory;
  description?: string;
  
  // Source
  templateId?: string;
  template?: Template;
  sourceContractId?: string;
  sourceType: DraftSourceType;
  
  // Content
  content: {
    sections: {
      id: string;
      name: string;
      clauses: DraftClause[];
    }[];
    header?: string;
    footer?: string;
  };
  variables: Record<string, any>;
  metadata?: Record<string, any>;
  
  // Status
  status: DraftStatus;
  version: number;
  
  // Parties
  internalParty?: PartyInfo;
  externalParties?: PartyInfo[];
  
  // Financials
  estimatedValue?: number;
  currency: string;
  paymentTerms?: {
    type: string;
    days?: number;
    schedule?: string;
    details?: string;
  };
  
  // Dates
  proposedStartDate?: Date;
  proposedEndDate?: Date;
  proposedNoticePeriod?: number;
  
  // Risk & Compliance
  riskScore?: number;
  complianceFlags?: {
    category: string;
    severity: RiskLevel;
    message: string;
    clauseId?: string;
  }[];
  
  // Collaboration
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: Date;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  executedAt?: Date;
  
  // Relations (for UI)
  clauses?: DraftClause[];
  collaborators?: DraftCollaborator[];
  comments?: DraftComment[];
  approvals?: Approval[];
}

export interface DraftCollaborator {
  id: string;
  draftId: string;
  userId?: string;
  email: string;
  name: string;
  role: 'OWNER' | 'EDITOR' | 'REVIEWER' | 'COMMENTER' | 'VIEWER';
  type: 'INTERNAL' | 'EXTERNAL';
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canApprove: boolean;
    sections?: string[];
  };
  invitedBy: string;
  invitedAt: Date;
  acceptedAt?: Date;
  lastActiveAt?: Date;
}

export interface DraftComment {
  id: string;
  draftId: string;
  parentId?: string;
  clauseId?: string;
  selectionStart?: number;
  selectionEnd?: number;
  content: string;
  authorId: string;
  authorName: string;
  authorType: 'INTERNAL' | 'EXTERNAL' | 'SYSTEM';
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  replies?: DraftComment[];
}

// ====================
// WORKFLOW TYPES
// ====================

export type WorkflowCategory =
  | 'CONTRACT_CREATION'
  | 'CONTRACT_REVIEW'
  | 'CONTRACT_APPROVAL'
  | 'RENEWAL'
  | 'AMENDMENT'
  | 'TERMINATION'
  | 'EXCEPTION'
  | 'COMPLIANCE_CHECK'
  | 'SIGNATURE';

export type TriggerType =
  | 'MANUAL'
  | 'DRAFT_CREATED'
  | 'DRAFT_SUBMITTED'
  | 'CONTRACT_VALUE_THRESHOLD'
  | 'RISK_SCORE_HIGH'
  | 'CLAUSE_DEVIATION'
  | 'RENEWAL_APPROACHING'
  | 'CONTRACT_EXPIRING'
  | 'AMENDMENT_REQUESTED'
  | 'COMPLIANCE_FLAG';

export type StepType =
  | 'APPROVAL'
  | 'REVIEW'
  | 'TASK'
  | 'NOTIFICATION'
  | 'CONDITIONAL'
  | 'PARALLEL'
  | 'DELAY'
  | 'INTEGRATION'
  | 'AI_ANALYSIS'
  | 'SIGNATURE';

export type AssigneeType =
  | 'USER'
  | 'ROLE'
  | 'MANAGER'
  | 'DYNAMIC'
  | 'ROUND_ROBIN'
  | 'LEAST_BUSY';

export interface WorkflowStep {
  id: string;
  workflowId: string;
  name: string;
  description?: string;
  order: number;
  type: StepType;
  config: Record<string, any>;
  
  // Assignment
  assigneeType: AssigneeType;
  assigneeValue?: string;
  fallbackAssignee?: string;
  
  // Timing
  dueInHours?: number;
  reminderHours?: number[];
  escalationHours?: number;
  escalateTo?: string;
  
  // Conditions
  conditions?: {
    field: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan';
    value: any;
  }[];
  skipConditions?: typeof conditions;
  
  // Actions
  onComplete?: {
    action: string;
    params: Record<string, any>;
  }[];
  onReject?: typeof onComplete;
  onTimeout?: typeof onComplete;
}

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category: WorkflowCategory;
  
  // Trigger
  triggerType: TriggerType;
  triggerConfig: {
    conditions?: Record<string, any>;
    schedule?: string;
    events?: string[];
  };
  
  // Steps
  steps: WorkflowStep[];
  
  // Settings
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  slaHours?: number;
  
  // Usage
  usageCount: number;
  avgCompletionHours?: number;
  
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InstanceStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED';

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflow?: WorkflowDefinition;
  
  // Target
  entityType: string;
  entityId: string;
  draftId?: string;
  
  // Progress
  currentStepOrder: number;
  status: InstanceStatus;
  
  // Context
  context?: Record<string, any>;
  variables?: Record<string, any>;
  
  // Timing
  startedAt: Date;
  dueAt?: Date;
  completedAt?: Date;
  
  // Initiator
  initiatedBy: string;
  initiationType: 'MANUAL' | 'AUTOMATIC' | 'SCHEDULED' | 'API';
  
  // Results
  stepResults?: StepResult[];
  approvals?: Approval[];
}

export interface StepResult {
  id: string;
  instanceId: string;
  stepOrder: number;
  stepName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'EXPIRED';
  outcome?: string;
  assigneeId?: string;
  assigneeName?: string;
  startedAt: Date;
  completedAt?: Date;
  data?: Record<string, any>;
  notes?: string;
}

export interface Approval {
  id: string;
  instanceId?: string;
  draftId?: string;
  stepOrder?: number;
  stepName?: string;
  
  // Approver
  approverId: string;
  approverName: string;
  approverEmail: string;
  
  // Status
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'DELEGATED' | 'EXPIRED' | 'CANCELLED';
  
  // Decision
  decision?: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'REQUEST_CHANGES' | 'ESCALATED';
  comments?: string;
  conditions?: string;
  
  // Timing
  createdAt: Date;
  dueAt?: Date;
  decidedAt?: Date;
  
  // Delegation
  delegatedTo?: string;
  delegatedAt?: Date;
  delegationReason?: string;
}

// ====================
// API TYPES
// ====================

export interface CreateDraftRequest {
  title: string;
  type: TemplateCategory;
  description?: string;
  templateId?: string;
  sourceContractId?: string;
  sourceType?: DraftSourceType;
  internalParty?: PartyInfo;
  externalParties?: PartyInfo[];
  estimatedValue?: number;
  currency?: string;
  proposedStartDate?: string;
  proposedEndDate?: string;
  variables?: Record<string, any>;
}

export interface UpdateDraftRequest {
  title?: string;
  description?: string;
  status?: DraftStatus;
  content?: ContractDraft['content'];
  variables?: Record<string, any>;
  internalParty?: PartyInfo;
  externalParties?: PartyInfo[];
  estimatedValue?: number;
  paymentTerms?: ContractDraft['paymentTerms'];
  proposedStartDate?: string;
  proposedEndDate?: string;
}

export interface SubmitForApprovalRequest {
  draftId: string;
  workflowId?: string;
  message?: string;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  dueDate?: string;
}

export interface ApprovalDecisionRequest {
  approvalId: string;
  decision: Approval['decision'];
  comments?: string;
  conditions?: string;
}

// ====================
// UI STATE TYPES
// ====================

export interface DraftEditorState {
  draft: ContractDraft;
  isDirty: boolean;
  isSaving: boolean;
  selectedClauseId?: string;
  selectedSectionId?: string;
  showPreview: boolean;
  showVariables: boolean;
  showComments: boolean;
  collaborativeSession?: {
    sessionId: string;
    activeUsers: { id: string; name: string; color: string; cursor?: { x: number; y: number } }[];
  };
}

export interface TemplatePickerState {
  isOpen: boolean;
  selectedCategory?: TemplateCategory;
  searchQuery: string;
  templates: Template[];
  isLoading: boolean;
}

export interface ClauseLibraryState {
  isOpen: boolean;
  selectedCategory?: ClauseCategory;
  searchQuery: string;
  clauses: LibraryClause[];
  isLoading: boolean;
  selectedClause?: LibraryClause;
}

export interface WorkflowProgressState {
  instance?: WorkflowInstance;
  currentStep?: WorkflowStep;
  nextActions: {
    action: string;
    label: string;
    variant: 'default' | 'destructive' | 'outline';
    onClick: () => void;
  }[];
  timeline: {
    stepName: string;
    status: StepResult['status'];
    assignee?: string;
    timestamp?: Date;
    notes?: string;
  }[];
}
