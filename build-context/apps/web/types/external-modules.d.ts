declare module "bullmq" {
  export const Queue: any;
  export const Worker: any;
  export const QueueEvents: any;
  export const FlowProducer: any;
  const BullMQ: any;
  export default BullMQ;
}

declare module "ioredis" {
  const Redis: any;
  export default Redis;
}

declare module "@google-cloud/vision" {
  export class ImageAnnotatorClient {
    constructor(options?: any);
    textDetection(image: Buffer | { content: Buffer }): Promise<any>;
  }
}

declare module "ovh" {
  function OVH(config: {
    endpoint: string;
    appKey: string;
    appSecret: string;
    consumerKey: string;
  }): {
    requestPromised: (method: string, path: string, body?: any) => Promise<any>;
  };
  export = OVH;
}

declare module "tesseract.js" {
  export function createWorker(lang?: string): Promise<{
    loadLanguage: (lang: string) => Promise<void>;
    initialize: (lang: string) => Promise<void>;
    recognize: (image: Buffer | string) => Promise<{ data: { text: string; confidence: number } }>;
    terminate: () => Promise<void>;
  }>;
}

declare module "@workspace/workers/categorization-worker" {
  export function queueCategorizationJob(params: {
    contractId: string;
    tenantId: string;
    text?: string;
    priority?: 'high' | 'normal' | 'low';
    autoApply?: boolean;
    autoApplyThreshold?: number;
    forceRecategorize?: boolean;
    source?: string;
  }): Promise<string>;
}

declare module "@workspace/workers/renewal-alert-worker" {
  export interface RenewalCheckJobData {
    tenantId?: string;
    daysAhead?: number;
    criticalThresholdDays?: number;
    warningThresholdDays?: number;
    autoRenewalOnly?: boolean;
    priority?: 'high' | 'normal' | 'low';
    source?: 'scheduled' | 'manual' | 'webhook';
  }
  
  export interface RenewalAlert {
    contractId: string;
    contractName: string;
    alertType: 'critical' | 'warning' | 'info';
    message: string;
    dueDate: string;
    daysRemaining: number;
    autoRenewal: boolean;
    tenantId: string;
    sourceClause?: string;
  }
  
  export interface RenewalCheckResult {
    success: boolean;
    alertsGenerated: number;
    contractsChecked: number;
    alerts: RenewalAlert[];
    processingTimeMs: number;
    errors?: string[];
  }
  
  export function triggerRenewalCheck(data: RenewalCheckJobData): Promise<{ id: string }>;
  export function scheduleRenewalCheck(tenantId?: string, options?: Partial<RenewalCheckJobData>): Promise<void>;
  export function registerRenewalAlertWorker(): any;
}

declare module "@workspace/workers/obligation-tracker-worker" {
  export interface ObligationCheckJobData {
    tenantId?: string;
    daysAhead?: number;
    includeOverdue?: boolean;
    obligationType?: 'deliverable' | 'sla' | 'milestone' | 'reporting' | 'compliance' | 'all';
    partyFilter?: string;
    criticalThresholdDays?: number;
    warningThresholdDays?: number;
    priority?: 'high' | 'normal' | 'low';
    source?: 'scheduled' | 'manual' | 'webhook';
  }
  
  export interface ObligationAlert {
    contractId: string;
    contractName: string;
    obligationId: string;
    obligationTitle: string;
    party: string;
    type: 'deliverable' | 'sla' | 'milestone' | 'reporting' | 'compliance' | 'other';
    alertType: 'critical' | 'warning' | 'info' | 'overdue';
    message: string;
    dueDate: string | null;
    daysRemaining: number | null;
    slaCriteria?: { metric: string; target: string | number; unit?: string };
    penalty?: string;
    tenantId: string;
    sourceClause?: string;
  }
  
  export interface SLAStatusAlert {
    contractId: string;
    contractName: string;
    metric: string;
    target: string | number;
    currentValue?: string | number;
    status: 'met' | 'at-risk' | 'breached';
    penalty?: string;
    tenantId: string;
  }
  
  export interface ObligationCheckResult {
    success: boolean;
    obligationAlerts: number;
    slaAlerts: number;
    contractsChecked: number;
    obligations: ObligationAlert[];
    slaStatuses: SLAStatusAlert[];
    processingTimeMs: number;
    errors?: string[];
  }
  
  export function triggerObligationCheck(data: ObligationCheckJobData): Promise<{ id: string }>;
  export function scheduleObligationCheck(tenantId?: string, options?: Partial<ObligationCheckJobData>): Promise<void>;
  export function getContractObligationSummary(contractId: string): Promise<any>;
  export function registerObligationTrackerWorker(): any;
}

declare module "@workspace/utils/queue/contract-queue" {
  export function getContractQueue(): {
    add: (name: string, data: any, opts?: any) => Promise<any>;
  };
}

// Support for relative path imports of the queue module
declare module "../../../../../../packages/utils/dist/queue/contract-queue" {
  export interface MetadataExtractionJobData {
    contractId: string;
    tenantId: string;
    autoApply?: boolean;
    autoApplyThreshold?: number;
    source?: 'upload' | 'manual' | 'reprocess' | 'bulk';
    priority?: 'high' | 'normal' | 'low';
    customSchemaId?: string;
  }
  
  export interface ContractQueueManager {
    queueMetadataExtraction(data: MetadataExtractionJobData, options?: { priority?: number; delay?: number }): Promise<string | null>;
    queueContractProcessing(data: any, options?: any): Promise<string | null>;
    queueCategorization(data: any, options?: any): Promise<string | null>;
  }
  
  export function getContractQueue(): ContractQueueManager;
}

declare module "../../../../../packages/utils/dist/queue/contract-queue" {
  export interface MetadataExtractionJobData {
    contractId: string;
    tenantId: string;
    autoApply?: boolean;
    autoApplyThreshold?: number;
    source?: 'upload' | 'manual' | 'reprocess' | 'bulk';
    priority?: 'high' | 'normal' | 'low';
    customSchemaId?: string;
  }
  
  export interface ContractQueueManager {
    queueMetadataExtraction(data: MetadataExtractionJobData, options?: { priority?: number; delay?: number }): Promise<string | null>;
    queueContractProcessing(data: any, options?: any): Promise<string | null>;
    queueCategorization(data: any, options?: any): Promise<string | null>;
  }
  
  export function getContractQueue(): ContractQueueManager;
}
