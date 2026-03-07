/**

 * Contract Generation Database Schema
 * Phase 1: Foundation for contract creation, templates, and workflows
 */

// ====================
// TEMPLATE & CLAUSE MANAGEMENT
// ====================

model Template {
    id       String @id @default(cuid())
    tenantId String

    // Basic Info
    name        String
    description String?
    category    TemplateCategory
    subcategory String?

    // Content
    content        Json // Rich template structure with placeholders
    variables      Json // Variable definitions with types and defaults
    defaultClauses String[] // Default clause IDs to include

    // Metadata
    version       Int     @default(1)
    isActive      Boolean @default(true)
    isPublic      Boolean @default(false) // Visible to all tenants
    thumbnail     String? // Preview image URL
    estimatedTime Int? // Minutes to complete

    // Usage tracking
    usageCount Int       @default(0)
    lastUsedAt DateTime?

    // Audit
    createdBy String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    // Relations
    drafts   ContractDraft[]
    versions TemplateVersion[]

    @@index([tenantId])
    @@index([category])
}

model TemplateVersion {
    id         String   @id @default(cuid())
    templateId String
    template   Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

    version   Int
    content   Json
    variables Json
    changelog String?

    createdBy String
    createdAt DateTime @default(now())

    @@index([templateId])
}

model Clause {
    id       String @id @default(cuid())
    tenantId String

    // Basic Info
    name        String
    title       String // Display title
    category    ClauseCategory
    subcategory String?

    // Content
    content     String  @db.Text
    contentHtml String? @db.Text // Rendered HTML
    variables   Json? // Variables used in this clause

    // Classification
    riskLevel    RiskLevel @default(LOW)
    isStandard   Boolean   @default(true) // Company standard clause
    isMandatory  Boolean   @default(false) // Must include in contracts
    isNegotiable Boolean   @default(true)

    // Alternatives & Guidance
    alternatives  Json? // Alternative clause versions [{id, name, content, riskDelta}]
    fallbackChain String[] // Ordered fallback clause IDs
    guidance      String?  @db.Text // Usage guidance for users
    playbook      Json? // Negotiation playbook for this clause

    // Metadata
    tags       String[]
    usageCount Int       @default(0)
    lastUsedAt DateTime?

    // Audit
    createdBy String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    // Relations
    draftClauses DraftClause[]

    @@index([tenantId])
    @@index([category])
    @@index([riskLevel])
}

// ====================
// CONTRACT DRAFTS
// ====================

model ContractDraft {
    id       String @id @default(cuid())
    tenantId String

    // Basic Info
    title       String
    type        ContractType
    description String?

    // Source
    templateId       String?
    template         Template?       @relation(fields: [templateId], references: [id])
    sourceContractId String? // If renewal/amendment, reference original
    sourceContract   Contract?       @relation("SourceContract", fields: [sourceContractId], references: [id])
    sourceType       DraftSourceType @default(NEW)

    // Content
    content   Json // Full document content with resolved variables
    variables Json // Variable values filled by user
    metadata  Json? // Additional metadata

    // Status
    status  DraftStatus @default(DRAFT)
    version Int         @default(1)

    // Parties
    internalParty   Json? // {name, signatories, contact}
    externalParties Json? // [{name, type, signatories, contact, email}]

    // Financials
    estimatedValue Float?
    currency       String @default("USD")
    paymentTerms   Json?

    // Dates
    proposedStartDate    DateTime?
    proposedEndDate      DateTime?
    proposedNoticePeriod Int? // Days

    // Risk & Compliance
    riskScore       Int?
    complianceFlags Json?

    // Collaboration
    isLocked Boolean   @default(false)
    lockedBy String?
    lockedAt DateTime?

    // Audit
    createdBy   String
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
    submittedAt DateTime?
    approvedAt  DateTime?
    executedAt  DateTime?

    // Relations
    clauses           DraftClause[]
    versions          DraftVersion[]
    comments          DraftComment[]
    collaborators     DraftCollaborator[]
    approvals         Approval[]
    workflowInstances WorkflowInstance[]

    // Generated contract after execution
    generatedContract Contract? @relation("GeneratedContract")

    @@index([tenantId])
    @@index([status])
    @@index([createdBy])
}

model DraftClause {
    id      String        @id @default(cuid())
    draftId String
    draft   ContractDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

    clauseId String? // Reference to clause library
    clause   Clause? @relation(fields: [clauseId], references: [id])

    // Content (may be modified from original)
    title           String
    content         String  @db.Text
    isModified      Boolean @default(false)
    originalContent String? @db.Text // If modified, store original

    // Positioning
    sectionId String?
    order     Int     @default(0)

    // Status
    status ClauseStatus @default(INCLUDED)

    // Risk
    riskLevel RiskLevel @default(LOW)
    riskNotes String?

    // Negotiation tracking
    isNegotiated       Boolean @default(false)
    negotiationHistory Json? // Track redline history

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([draftId])
}

model DraftVersion {
    id      String        @id @default(cuid())
    draftId String
    draft   ContractDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

    version   Int
    content   Json
    variables Json
    clauses   Json // Snapshot of clauses

    changeType    ChangeType
    changeSummary String?
    changedBy     String

    createdAt DateTime @default(now())

    @@index([draftId])
}

model DraftComment {
    id      String        @id @default(cuid())
    draftId String
    draft   ContractDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

    parentId String?
    parent   DraftComment?  @relation("CommentReplies", fields: [parentId], references: [id])
    replies  DraftComment[] @relation("CommentReplies")

    // Location
    clauseId       String?
    selectionStart Int?
    selectionEnd   Int?

    content    String     @db.Text
    authorId   String
    authorName String
    authorType AuthorType @default(INTERNAL)

    isResolved Boolean   @default(false)
    resolvedBy String?
    resolvedAt DateTime?

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([draftId])
}

model DraftCollaborator {
    id      String        @id @default(cuid())
    draftId String
    draft   ContractDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)

    userId String?
    email  String
    name   String
    role   CollaboratorRole
    type   AuthorType       @default(INTERNAL)

    permissions Json // {canEdit, canComment, canApprove, sections: [...]}

    invitedBy    String
    invitedAt    DateTime  @default(now())
    acceptedAt   DateTime?
    lastActiveAt DateTime?

    @@unique([draftId, email])
    @@index([draftId])
}

// ====================
// WORKFLOW ENGINE
// ====================

model Workflow {
    id       String @id @default(cuid())
    tenantId String

    name        String
    description String?
    category    WorkflowCategory

    // Trigger
    triggerType   TriggerType
    triggerConfig Json // Conditions for auto-trigger

    // Steps
    steps WorkflowStep[]

    // Settings
    isActive  Boolean @default(true)
    isDefault Boolean @default(false) // Default for category
    priority  Int     @default(0)
    slaHours  Int? // Overall SLA

    // Usage
    usageCount         Int    @default(0)
    avgCompletionHours Float?

    createdBy String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    instances WorkflowInstance[]

    @@index([tenantId])
    @@index([category])
}

model WorkflowStep {
    id         String   @id @default(cuid())
    workflowId String
    workflow   Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

    name        String
    description String?
    order       Int

    type   StepType
    config Json // Step-specific configuration

    // Assignment
    assigneeType     AssigneeType
    assigneeValue    String? // User ID, Role name, or expression
    fallbackAssignee String?

    // Timing
    dueInHours      Int?
    reminderHours   Int[] // Hours before due to send reminders
    escalationHours Int? // Hours after due to escalate
    escalateTo      String?

    // Conditions
    conditions     Json? // Entry conditions
    skipConditions Json? // When to auto-skip this step

    // Actions
    onComplete Json? // Actions to take on completion
    onReject   Json? // Actions on rejection
    onTimeout  Json? // Actions on timeout

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([workflowId])
}

model WorkflowInstance {
    id         String   @id @default(cuid())
    workflowId String
    workflow   Workflow @relation(fields: [workflowId], references: [id])

    // Target entity
    entityType String // "contract_draft", "contract", "renewal"
    entityId   String

    // For contract drafts
    draftId String?
    draft   ContractDraft? @relation(fields: [draftId], references: [id])

    // Progress
    currentStepOrder Int            @default(0)
    status           InstanceStatus @default(PENDING)

    // Context
    context   Json? // Workflow context data
    variables Json? // Computed variables

    // Timing
    startedAt   DateTime  @default(now())
    dueAt       DateTime?
    completedAt DateTime?

    // Initiator
    initiatedBy    String
    initiationType InitiationType @default(MANUAL)

    // Results
    stepResults StepResult[]
    approvals   Approval[]

    @@index([workflowId])
    @@index([entityType, entityId])
    @@index([status])
}

model StepResult {
    id         String           @id @default(cuid())
    instanceId String
    instance   WorkflowInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

    stepOrder Int
    stepName  String

    status  StepStatus
    outcome String? // "approved", "rejected", "completed", etc.

    assigneeId   String?
    assigneeName String?

    startedAt   DateTime  @default(now())
    completedAt DateTime?

    data  Json? // Step output data
    notes String?

    @@index([instanceId])
}

model Approval {
    id String @id @default(cuid())

    // Parent reference
    instanceId String?
    instance   WorkflowInstance? @relation(fields: [instanceId], references: [id])

    draftId String?
    draft   ContractDraft? @relation(fields: [draftId], references: [id])

    // Step info
    stepOrder Int?
    stepName  String?

    // Approver
    approverId    String
    approverName  String
    approverEmail String

    // Status
    status ApprovalStatus @default(PENDING)

    // Decision
    decision   ApprovalDecision?
    comments   String?           @db.Text
    conditions String? // Approved with conditions

    // Timing
    createdAt DateTime  @default(now())
    dueAt     DateTime?
    decidedAt DateTime?

    // Delegation
    delegatedTo      String?
    delegatedAt      DateTime?
    delegationReason String?

    @@index([instanceId])
    @@index([draftId])
    @@index([approverId])
    @@index([status])
}

// ====================
// ENUMS
// ====================

enum TemplateCategory {
    MSA // Master Service Agreement
    SOW // Statement of Work
    NDA // Non-Disclosure Agreement
    AMENDMENT // Contract Amendment
    RENEWAL // Renewal Agreement
    ORDER_FORM // Order Form
    SLA // Service Level Agreement
    DPA // Data Processing Agreement
    SUBCONTRACT // Subcontractor Agreement
    CONSULTING // Consulting Agreement
    LICENSE // License Agreement
    OTHER
}

enum ContractType {
    MSA
    SOW
    NDA
    AMENDMENT
    RENEWAL
    ORDER_FORM
    SLA
    DPA
    SUBCONTRACT
    CONSULTING
    LICENSE
    OTHER
}

enum ClauseCategory {
    DEFINITIONS
    SCOPE
    TERM
    PAYMENT
    TERMINATION
    LIABILITY
    INDEMNIFICATION
    CONFIDENTIALITY
    IP_RIGHTS
    DATA_PROTECTION
    COMPLIANCE
    INSURANCE
    DISPUTE_RESOLUTION
    GOVERNING_LAW
    FORCE_MAJEURE
    ASSIGNMENT
    NOTICES
    AMENDMENTS
    SURVIVAL
    ENTIRE_AGREEMENT
    MISCELLANEOUS
}

enum RiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
}

enum DraftStatus {
    DRAFT
    IN_REVIEW
    PENDING_APPROVAL
    APPROVED
    REJECTED
    PENDING_SIGNATURE
    EXECUTED
    CANCELLED
    ARCHIVED
}

enum DraftSourceType {
    NEW
    TEMPLATE
    RENEWAL
    AMENDMENT
    CLONE
    IMPORT
}

enum ClauseStatus {
    INCLUDED
    EXCLUDED
    PENDING_REVIEW
    NEGOTIATING
    AGREED
    REJECTED
}

enum ChangeType {
    CONTENT
    CLAUSE_ADDED
    CLAUSE_REMOVED
    CLAUSE_MODIFIED
    VARIABLE_CHANGED
    STATUS_CHANGED
    METADATA
}

enum AuthorType {
    INTERNAL
    EXTERNAL
    SYSTEM
}

enum CollaboratorRole {
    OWNER
    EDITOR
    REVIEWER
    COMMENTER
    VIEWER
}

enum WorkflowCategory {
    CONTRACT_CREATION
    CONTRACT_REVIEW
    CONTRACT_APPROVAL
    RENEWAL
    AMENDMENT
    TERMINATION
    EXCEPTION
    COMPLIANCE_CHECK
    SIGNATURE
}

enum TriggerType {
    MANUAL
    DRAFT_CREATED
    DRAFT_SUBMITTED
    CONTRACT_VALUE_THRESHOLD
    RISK_SCORE_HIGH
    CLAUSE_DEVIATION
    RENEWAL_APPROACHING
    CONTRACT_EXPIRING
    AMENDMENT_REQUESTED
    COMPLIANCE_FLAG
}

enum StepType {
    APPROVAL
    REVIEW
    TASK
    NOTIFICATION
    CONDITIONAL
    PARALLEL
    DELAY
    INTEGRATION
    AI_ANALYSIS
    SIGNATURE
}

enum AssigneeType {
    USER
    ROLE
    MANAGER
    DYNAMIC
    ROUND_ROBIN
    LEAST_BUSY
}

enum InstanceStatus {
    PENDING
    ACTIVE
    PAUSED
    COMPLETED
    CANCELLED
    FAILED
    EXPIRED
}

enum InitiationType {
    MANUAL
    AUTOMATIC
    SCHEDULED
    API
}

enum StepStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    SKIPPED
    FAILED
    EXPIRED
}

enum ApprovalStatus {
    PENDING
    IN_PROGRESS
    APPROVED
    REJECTED
    DELEGATED
    EXPIRED
    CANCELLED
}

enum ApprovalDecision {
    APPROVED
    APPROVED_WITH_CONDITIONS
    REJECTED
    REQUEST_CHANGES
    ESCALATED
}
