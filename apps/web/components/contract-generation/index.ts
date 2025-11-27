/**
 * Contract Generation Module
 * 
 * This module provides comprehensive contract creation, template management,
 * clause library, and workflow orchestration capabilities.
 */

// Page Components
export { default as ContractGenerationPage } from '../../app/generate/page';

// Editor Components
export { ContractEditor } from './ContractEditor';

// Template Components
export { TemplateManager } from './TemplateManager';

// Workflow Components
export { WorkflowBuilder } from './WorkflowBuilder';

// Re-export types
export type {
  // Template Types
  Template,
  TemplateCategory,
  TemplateVariable,
  TemplateSection,
  
  // Clause Types
  LibraryClause,
  ClauseCategory,
  ClauseAlternative,
  NegotiationPlaybook,
  
  // Draft Types
  ContractDraft,
  DraftClause,
  DraftStatus,
  DraftSourceType,
  ClauseStatus,
  DraftCollaborator,
  DraftComment,
  PartyInfo,
  
  // Workflow Types
  WorkflowDefinition,
  WorkflowStep,
  WorkflowInstance,
  TriggerType,
  StepType,
  AssigneeType,
  WorkflowCategory,
  InstanceStatus,
  StepResult,
  Approval,
  
  // Risk Types
  RiskLevel,
  
  // API Types
  CreateDraftRequest,
  UpdateDraftRequest,
  SubmitForApprovalRequest,
  ApprovalDecisionRequest,
  
  // UI State Types
  DraftEditorState,
  TemplatePickerState,
  ClauseLibraryState,
  WorkflowProgressState,
} from '../../types/contract-generation';
