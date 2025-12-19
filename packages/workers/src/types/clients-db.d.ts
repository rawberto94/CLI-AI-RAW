// Type declarations for clients-db workspace package
declare module 'clients-db' {
  import { PrismaClient } from '@prisma/client';
  
  export default function getClient(): PrismaClient;
  
  export * from '@prisma/client';
  
  // Re-export common types
  export type { 
    Contract,
    Artifact,
    User,
    Tenant,
    ProcessingJob,
    WebhookDelivery,
  } from '@prisma/client';
}
