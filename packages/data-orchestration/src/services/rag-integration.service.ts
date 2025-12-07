/**
 * RAG Integration Service
 * 
 * Handles re-indexing of contracts when artifacts or metadata change.
 * This ensures the AI chatbot always has up-to-date information.
 */

import getClient from 'clients-db';
import pino from 'pino';

const logger = pino({ name: 'rag-integration-service' });

class RagIntegrationService {
  private static instance: RagIntegrationService;

  private constructor() {}

  public static getInstance(): RagIntegrationService {
    if (!RagIntegrationService.instance) {
      RagIntegrationService.instance = new RagIntegrationService();
    }
    return RagIntegrationService.instance;
  }

  /**
   * Index a document with its content
   */
  async indexDocument(documentId: string, content: string): Promise<void> {
    logger.info({ documentId }, 'Indexing document');
    // This is called for new documents - handled by rag-indexing-worker
  }

  async query(query: string, context?: any): Promise<any> {
    return {
      results: [],
      sources: [],
    };
  }

  /**
   * Re-index a contract after artifact/metadata changes
   * This updates the RAG embeddings to include current artifact data
   */
  async reindexContract(contractId: string): Promise<void> {
    const prisma = getClient();
    
    try {
      logger.info({ contractId }, 'Re-indexing contract for RAG');

      // Get contract with all current data
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          artifacts: true,
        },
      });

      if (!contract) {
        logger.warn({ contractId }, 'Contract not found for re-indexing');
        return;
      }

      // Build artifact summary text for embedding
      const artifactSummary = this.buildArtifactSummary(contract.artifacts || []);
      const metadataSummary = this.buildMetadataSummary(contract.metadata as Record<string, unknown> | null);

      // Check if we have an existing metadata embedding chunk
      const existingMetadataChunk = await prisma.contractEmbedding.findFirst({
        where: {
          contractId,
          chunkType: 'metadata',
        },
      });

      if (!artifactSummary && !metadataSummary) {
        logger.info({ contractId }, 'No artifact/metadata to index');
        return;
      }

      const combinedSummary = [
        '=== CONTRACT METADATA & ARTIFACTS ===',
        metadataSummary,
        artifactSummary,
      ].filter(Boolean).join('\n\n');

      // Generate embedding for the artifact summary
      const embedding = await this.generateEmbedding(combinedSummary);
      
      if (!embedding) {
        logger.warn({ contractId }, 'Failed to generate embedding');
        return;
      }

      // Import pgvector utility
      const { toSql } = await import('pgvector/utils');
      const embeddingVector = toSql(embedding);

      if (existingMetadataChunk) {
        // Update existing metadata chunk
        await prisma.$executeRawUnsafe(`
          UPDATE "ContractEmbedding" 
          SET "chunkText" = $1, 
              "embedding" = $2::vector,
              "updatedAt" = NOW()
          WHERE "id" = $3
        `, combinedSummary, embeddingVector, existingMetadataChunk.id);
        
        logger.info({ contractId }, 'Updated existing metadata embedding');
      } else {
        // Insert new metadata chunk
        await prisma.$executeRawUnsafe(`
          INSERT INTO "ContractEmbedding" 
          ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, 9999, $2, $3::vector, 'metadata', 'Extracted Metadata & Artifacts', NOW(), NOW())
        `, contractId, combinedSummary, embeddingVector);
        
        logger.info({ contractId }, 'Created new metadata embedding');
      }

      logger.info({ contractId }, 'Contract re-indexed successfully');
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to re-index contract');
      // Don't throw - this is a background operation
    }
  }

  /**
   * Build a text summary of all artifacts for embedding
   */
  private buildArtifactSummary(artifacts: any[]): string {
    if (!artifacts || artifacts.length === 0) return '';

    const lines: string[] = ['EXTRACTED ARTIFACTS:'];

    for (const artifact of artifacts) {
      const data = artifact.data as any;
      if (!data) continue;

      lines.push(`\n[${artifact.artifactType.toUpperCase()}]`);

      // Handle different artifact types
      switch (artifact.artifactType) {
        case 'contract_metadata':
          if (data.partyA) lines.push(`Party A: ${data.partyA}`);
          if (data.partyB) lines.push(`Party B (Supplier): ${data.partyB}`);
          if (data.effectiveDate) lines.push(`Effective Date: ${data.effectiveDate}`);
          if (data.expirationDate) lines.push(`Expiration Date: ${data.expirationDate}`);
          if (data.totalValue) lines.push(`Contract Value: $${Number(data.totalValue).toLocaleString()}`);
          if (data.contractType) lines.push(`Contract Type: ${data.contractType}`);
          if (data.autoRenewal !== undefined) lines.push(`Auto-Renewal: ${data.autoRenewal ? 'Yes' : 'No'}`);
          if (data.paymentTerms) lines.push(`Payment Terms: ${data.paymentTerms}`);
          break;

        case 'key_clauses':
          if (Array.isArray(data.clauses)) {
            for (const clause of data.clauses.slice(0, 10)) {
              lines.push(`${clause.type}: ${clause.summary || clause.text?.slice(0, 200)}`);
            }
          }
          break;

        case 'labor_rates':
        case 'rate_card':
          if (Array.isArray(data.rates)) {
            lines.push('Labor Rates:');
            for (const rate of data.rates.slice(0, 15)) {
              lines.push(`  - ${rate.role || rate.title}: $${rate.hourlyRate || rate.rate}/hr`);
            }
          }
          break;

        case 'milestones':
        case 'deliverables':
          if (Array.isArray(data.items || data.milestones || data.deliverables)) {
            const items = data.items || data.milestones || data.deliverables;
            lines.push('Key Deliverables:');
            for (const item of items.slice(0, 10)) {
              lines.push(`  - ${item.name || item.title}: ${item.dueDate || 'No date'}`);
            }
          }
          break;

        case 'obligations':
          if (Array.isArray(data.obligations)) {
            lines.push('Obligations:');
            for (const ob of data.obligations.slice(0, 10)) {
              lines.push(`  - [${ob.party}] ${ob.description?.slice(0, 150)}`);
            }
          }
          break;

        case 'risk_assessment':
          if (data.overallRisk) lines.push(`Overall Risk Level: ${data.overallRisk}`);
          if (Array.isArray(data.risks)) {
            for (const risk of data.risks.slice(0, 5)) {
              lines.push(`  - ${risk.type}: ${risk.severity} - ${risk.description?.slice(0, 100)}`);
            }
          }
          break;

        default:
          // Generic handling for other artifact types
          const stringified = JSON.stringify(data).slice(0, 500);
          lines.push(stringified);
      }
    }

    return lines.join('\n');
  }

  /**
   * Build a text summary of contract metadata
   */
  private buildMetadataSummary(metadata: any): string {
    if (!metadata) return '';

    const lines: string[] = ['CONTRACT METADATA:'];
    
    if (metadata.contractTitle) lines.push(`Title: ${metadata.contractTitle}`);
    if (metadata.supplierName) lines.push(`Supplier: ${metadata.supplierName}`);
    if (metadata.category) lines.push(`Category: ${metadata.category}`);
    if (metadata.subcategory) lines.push(`Subcategory: ${metadata.subcategory}`);
    if (metadata.department) lines.push(`Department: ${metadata.department}`);
    if (metadata.costCenter) lines.push(`Cost Center: ${metadata.costCenter}`);
    if (metadata.tags && Array.isArray(metadata.tags)) {
      lines.push(`Tags: ${metadata.tags.join(', ')}`);
    }
    if (metadata.notes) lines.push(`Notes: ${metadata.notes}`);

    return lines.length > 1 ? lines.join('\n') : '';
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.warn('OpenAI API key not configured');
        return null;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });
      
      const model = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';
      const response = await openai.embeddings.create({
        model,
        input: text.slice(0, 8000), // Limit to model max
      });

      return response.data[0]?.embedding || null;
    } catch (error) {
      logger.error({ error }, 'Failed to generate embedding');
      return null;
    }
  }
}

export const ragIntegrationService = RagIntegrationService.getInstance();
