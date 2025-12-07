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
