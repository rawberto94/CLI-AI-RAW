/**
 * RAG Integration Service
 * 
 * Handles re-indexing of contracts when artifacts or metadata change.
 * This ensures the AI chatbot always has up-to-date information.
 * Now includes contract taxonomy integration for enhanced context.
 */

import getClient from 'clients-db';
import { createLogger } from '../utils/logger';
import { enrichContractForRAG } from './taxonomy-rag-integration.service';

const logger = createLogger('rag-integration-service');

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

  // ─── Per-artifact-type chunk index offsets ──────────────────────────
  // Each artifact type gets its own embedding chunk for vector specificity.
  // Reserved range: 9900–9949 for artifact types, 9950 for taxonomy+metadata.
  private static readonly ARTIFACT_CHUNK_OFFSETS: Record<string, number> = {
    overview:            9901,
    clauses:             9902,
    financial:           9903,
    risk:                9904,
    compliance:          9905,
    obligations:         9906,
    renewal:             9907,
    negotiation_points:  9908,
    amendments:          9909,
    contacts:            9910,
    parties:             9911,
    timeline:            9912,
    deliverables:        9913,
    executive_summary:   9914,
    rates:               9915,
    // Legacy types that may appear in older data
    contract_metadata:   9916,
    key_clauses:         9917,
    labor_rates:         9918,
    rate_card:           9919,
    risk_assessment:     9920,
    milestones:          9921,
    negotiation:         9908, // alias
  };
  // Taxonomy + contract-level metadata chunk
  private static readonly METADATA_CHUNK_INDEX = 9950;
  // Legacy single-blob chunk index (for cleanup during migration)
  private static readonly LEGACY_CHUNK_INDEX = 9999;

  /**
   * Re-index a contract after artifact/metadata changes.
   *
   * Strategy (v2 — per-type chunks):
   *   • Each of the 15 artifact types gets its own embedding at chunkIndex 990x
   *   • Taxonomy + ContractMetadata rich fields get a dedicated chunk at 9950
   *   • Old single-blob chunk at 9999 is cleaned up
   *   • This gives 15× better vector specificity — a financial query hits the
   *     financial artifact embedding, not a mega-blob containing all 15 types.
   */
  async reindexContract(contractId: string): Promise<void> {
    const prisma = getClient();

    try {
      logger.info({ contractId }, 'Re-indexing contract for RAG (per-type chunks v2)');

      // Get contract with all current data + ContractMetadata for rich fields
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          artifacts: true,
          contractMetadata: true,
        },
      });

      if (!contract) {
        logger.warn({ contractId }, 'Contract not found for re-indexing');
        return;
      }

      const artifacts = contract.artifacts || [];
      const { toSql } = await import('pgvector/utils');

      // ── 1. Per-artifact-type chunks ──────────────────────────────────
      let embeddedCount = 0;
      let textOnlyCount = 0;

      for (const artifact of artifacts) {
        const data = artifact.data as any;
        if (!data) continue;

        const artifactType = (artifact.type || (artifact as any).artifactType || '').toLowerCase();
        if (!artifactType) continue;

        const chunkIndex = RagIntegrationService.ARTIFACT_CHUNK_OFFSETS[artifactType];
        if (!chunkIndex) {
          logger.debug({ artifactType, contractId }, 'Unknown artifact type — skipping');
          continue;
        }

        // Build text for this single artifact type
        const text = this.buildSingleArtifactText(artifactType, data);
        if (!text || text.length < 20) continue;

        // Prefix with type label for BM25 keyword matching
        const chunkText = `[ARTIFACT: ${artifactType.toUpperCase()}]\n${text}`;

        const sectionLabel = `Artifact: ${artifactType.replace(/_/g, ' ')}`;

        // Generate embedding
        const embedding = await this.generateEmbedding(chunkText);

        if (embedding) {
          const embeddingVector = toSql(embedding);
          // Upsert: uses the (contractId, chunkIndex) unique constraint
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ContractEmbedding"
            ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, 'metadata', $5, $6, $7, NOW(), NOW())
            ON CONFLICT ("contractId", "chunkIndex")
            DO UPDATE SET
              "chunkText"    = EXCLUDED."chunkText",
              "embedding"    = EXCLUDED."embedding",
              "section"      = EXCLUDED."section",
              "tenantId"     = EXCLUDED."tenantId",
              "contractType" = EXCLUDED."contractType",
              "updatedAt"    = NOW()
          `, contractId, chunkIndex, chunkText, embeddingVector, sectionLabel,
             contract.tenantId || null, contract.contractType || null);
          embeddedCount++;
        } else {
          // Fallback: store text without embedding for BM25 keyword search
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ContractEmbedding"
            ("id", "contractId", "chunkIndex", "chunkText", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, 'metadata', $4, $5, $6, NOW(), NOW())
            ON CONFLICT ("contractId", "chunkIndex")
            DO UPDATE SET
              "chunkText"    = EXCLUDED."chunkText",
              "section"      = EXCLUDED."section",
              "tenantId"     = EXCLUDED."tenantId",
              "contractType" = EXCLUDED."contractType",
              "updatedAt"    = NOW()
          `, contractId, chunkIndex, chunkText, sectionLabel,
             contract.tenantId || null, contract.contractType || null);
          textOnlyCount++;
        }
      }

      // ── 2. Taxonomy + ContractMetadata rich fields chunk ─────────────
      const metadataSummary = this.buildMetadataSummary(
        contract.metadata as Record<string, unknown> | null
      );
      const richMetadata = this.buildRichContractMetadata(
        contract.contractMetadata as any
      );
      const taxonomyContext = enrichContractForRAG({
        id: contract.id,
        fileName: contract.fileName,
        rawText: contract.rawText || undefined,
        contractCategoryId: contract.contractCategoryId || undefined,
        contractSubtype: contract.contractSubtype || undefined,
        documentRole: contract.documentRole || undefined,
        classificationMeta: contract.classificationMeta as Record<string, unknown> | undefined,
        pricingModels: contract.pricingModels as string[] | undefined,
        deliveryModels: contract.deliveryModels as string[] | undefined,
        dataProfiles: contract.dataProfiles as string[] | undefined,
        riskFlags: contract.riskFlags as string[] | undefined,
      });

      const metaChunkParts = [
        '=== CONTRACT METADATA & TAXONOMY ===',
        taxonomyContext,
        metadataSummary,
        richMetadata,
      ].filter(Boolean);

      if (metaChunkParts.length > 1) {
        const metaChunkText = metaChunkParts.join('\n\n');
        const metaEmbedding = await this.generateEmbedding(metaChunkText);

        if (metaEmbedding) {
          const metaVector = toSql(metaEmbedding);
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ContractEmbedding"
            ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, 'metadata', 'Contract Metadata & Taxonomy', $5, $6, NOW(), NOW())
            ON CONFLICT ("contractId", "chunkIndex")
            DO UPDATE SET
              "chunkText"    = EXCLUDED."chunkText",
              "embedding"    = EXCLUDED."embedding",
              "tenantId"     = EXCLUDED."tenantId",
              "contractType" = EXCLUDED."contractType",
              "updatedAt"    = NOW()
          `, contractId, RagIntegrationService.METADATA_CHUNK_INDEX, metaChunkText, metaVector,
             contract.tenantId || null, contract.contractType || null);
        } else {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ContractEmbedding"
            ("id", "contractId", "chunkIndex", "chunkText", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, 'metadata', 'Contract Metadata & Taxonomy', $4, $5, NOW(), NOW())
            ON CONFLICT ("contractId", "chunkIndex")
            DO UPDATE SET
              "chunkText" = EXCLUDED."chunkText",
              "tenantId"  = EXCLUDED."tenantId",
              "contractType" = EXCLUDED."contractType",
              "updatedAt" = NOW()
          `, contractId, RagIntegrationService.METADATA_CHUNK_INDEX, metaChunkText,
             contract.tenantId || null, contract.contractType || null);
        }
      }

      // ── 3. Clean up legacy single-blob chunk (9999) ─────────────────
      await prisma.contractEmbedding.deleteMany({
        where: {
          contractId,
          chunkIndex: RagIntegrationService.LEGACY_CHUNK_INDEX,
        },
      });

      // ── 4. Update ContractMetadata RAG sync tracking ────────────────
      if (contract.contractMetadata) {
        await prisma.contractMetadata.update({
          where: { contractId },
          data: {
            ragSyncedAt: new Date(),
            embeddingCount: embeddedCount + (metaChunkParts.length > 1 ? 1 : 0),
            lastEmbeddingAt: new Date(),
          },
        });
      }

      logger.info(
        { contractId, embeddedCount, textOnlyCount, artifactCount: artifacts.length },
        'Contract re-indexed successfully (per-type chunks v2)'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, contractId }, 'Failed to re-index contract');
      // Don't throw - this is a background operation
    }
  }

  /**
   * Build text for a single artifact type (for per-type embedding).
   * Delegates to the same switch-case logic as before but returns text
   * for only one artifact type instead of concatenating all.
   */
  private buildSingleArtifactText(normalizedType: string, data: any): string {
    const lines: string[] = [];

    switch (normalizedType) {
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

      case 'risk_assessment':
        if (data.overallRisk) lines.push(`Overall Risk Level: ${data.overallRisk}`);
        if (Array.isArray(data.risks)) {
          for (const risk of data.risks.slice(0, 5)) {
            lines.push(`  - ${risk.type}: ${risk.severity} - ${risk.description?.slice(0, 100)}`);
          }
        }
        break;

      case 'overview':
        if (data.summary?.value) lines.push(`Summary: ${data.summary.value}`);
        if (Array.isArray(data.parties)) {
          lines.push('Parties:');
          for (const party of data.parties) {
            lines.push(`  - ${party.name} (${party.role})`);
          }
        }
        if (data.contractType?.value) lines.push(`Contract Type: ${data.contractType.value}`);
        if (data.effectiveDate?.value) lines.push(`Effective Date: ${data.effectiveDate.value}`);
        if (data.expirationDate?.value) lines.push(`Expiration Date: ${data.expirationDate.value}`);
        if (data.term?.value) lines.push(`Term: ${data.term.value}`);
        if (data.jurisdiction?.value) lines.push(`Jurisdiction: ${data.jurisdiction.value}`);
        if (Array.isArray(data.keyTerms) && data.keyTerms.length > 0) {
          lines.push(`Key Terms: ${data.keyTerms.join(', ')}`);
        }
        if (Array.isArray(data.definitions)) {
          lines.push('Definitions:');
          for (const def of data.definitions.slice(0, 10)) {
            lines.push(`  - "${def.term}" means ${def.meaning}`);
          }
        }
        if (Array.isArray(data.referencedDocuments)) {
          lines.push('Referenced Documents:');
          for (const doc of data.referencedDocuments) {
            lines.push(`  - ${doc.name}: ${doc.description || ''}`);
          }
        }
        if (data.additionalData && typeof data.additionalData === 'object') {
          for (const [key, value] of Object.entries(data.additionalData)) {
            if (typeof value === 'object' && (value as any)?.value) {
              lines.push(`  ${key}: ${(value as any).value}`);
            } else if (typeof value === 'string' || typeof value === 'number') {
              lines.push(`  ${key}: ${value}`);
            }
          }
        }
        if (data.rawSections && typeof data.rawSections === 'object') {
          for (const [section, text] of Object.entries(data.rawSections)) {
            if (typeof text === 'string') {
              lines.push(`\n${section}:\n${text.slice(0, 500)}`);
            }
          }
        }
        break;

      case 'clauses':
        if (Array.isArray(data.clauses)) {
          for (const clause of data.clauses.slice(0, 15)) {
            const sectionNum = clause.sectionNumber ? `[${clause.sectionNumber}] ` : '';
            lines.push(`${sectionNum}${clause.type}: ${clause.title || ''}`);
            lines.push(`  Risk: ${clause.riskLevel}, Importance: ${clause.importance}`);
            if (clause.content) lines.push(`  ${clause.content.slice(0, 200)}`);
            if (Array.isArray(clause.obligations) && clause.obligations.length > 0) {
              lines.push(`  Obligations: ${clause.obligations.join('; ')}`);
            }
            if (Array.isArray(clause.crossReferences)) {
              for (const ref of clause.crossReferences) {
                lines.push(`  Cross-ref: ${ref.from} → ${ref.to}`);
              }
            }
            if (Array.isArray(clause.subclauses)) {
              for (const sub of clause.subclauses.slice(0, 5)) {
                lines.push(`    ${sub.sectionNumber || ''}: ${sub.title || sub.content?.slice(0, 100)}`);
              }
            }
          }
        }
        if (Array.isArray(data.customClauseTypes) && data.customClauseTypes.length > 0) {
          lines.push(`Custom Clause Types: ${data.customClauseTypes.join(', ')}`);
        }
        if (Array.isArray(data.referencedExhibits)) {
          lines.push('Referenced Exhibits:');
          for (const ex of data.referencedExhibits) {
            lines.push(`  - ${ex.name}: ${ex.purpose || ''}`);
          }
        }
        if (Array.isArray(data.missingClauses) && data.missingClauses.length > 0) {
          lines.push(`Missing Standard Clauses: ${data.missingClauses.join(', ')}`);
        }
        break;

      case 'rates':
        if (Array.isArray(data.rateCards)) {
          lines.push('Rate Cards:');
          for (const rate of data.rateCards.slice(0, 20)) {
            const loc = rate.location ? ` (${rate.location})` : '';
            lines.push(`  - ${rate.role}: ${rate.currency || 'USD'} ${rate.rate}/${rate.unit}${loc}`);
          }
        }
        if (Array.isArray(data.rawRateTables)) {
          for (const table of data.rawRateTables) {
            lines.push(`\nRate Table: ${table.tableName || 'Rate Card'}`);
            if (Array.isArray(table.headers)) {
              lines.push(`  Columns: ${table.headers.join(' | ')}`);
            }
            if (Array.isArray(table.rows)) {
              for (const row of table.rows.slice(0, 15)) {
                const values = table.headers?.map((h: string) => row[h] || '').join(' | ');
                lines.push(`    ${values}`);
              }
            }
            if (table.notes) lines.push(`  Notes: ${table.notes}`);
          }
        }
        if (Array.isArray(data.rateConditions)) {
          lines.push('Rate Conditions:');
          for (const cond of data.rateConditions) {
            lines.push(`  - ${cond.condition}: ${cond.trigger}`);
          }
        }
        if (Array.isArray(data.rateModifiers)) {
          lines.push('Rate Modifiers:');
          for (const mod of data.rateModifiers) {
            lines.push(`  - ${mod.type}: ${mod.condition} = ${mod.adjustment}${mod.unit === 'percentage' ? '%' : ''}`);
          }
        }
        if (data.rateEscalation) {
          lines.push(`Rate Escalation: ${data.rateEscalation.schedule || ''} ${data.rateEscalation.percentage || data.rateEscalation.fixedIncrease || ''}`);
        }
        break;

      case 'compliance':
        if (Array.isArray(data.regulations)) {
          lines.push('Regulations:');
          for (const reg of data.regulations) {
            lines.push(`  - ${reg.name}${reg.scope ? ` (${reg.scope})` : ''}`);
          }
        }
        if (Array.isArray(data.certifications)) {
          lines.push('Certifications Required:');
          for (const cert of data.certifications) {
            lines.push(`  - ${cert.name}${cert.renewalPeriod ? ` (${cert.renewalPeriod})` : ''}`);
          }
        }
        if (Array.isArray(data.complianceRequirements)) {
          lines.push('Compliance Requirements:');
          for (const req of data.complianceRequirements.slice(0, 15)) {
            lines.push(`  - [${req.responsibility || 'party'}] ${req.requirement} (${req.frequency || 'ongoing'})`);
          }
        }
        if (Array.isArray(data.complianceTimelines)) {
          lines.push('Compliance Timelines:');
          for (const tl of data.complianceTimelines) {
            lines.push(`  - ${tl.requirement}: ${tl.deadline}`);
          }
        }
        if (data.breachNotification) {
          lines.push(`Breach Notification: ${data.breachNotification.timeframe}`);
        }
        if (data.dataRetention) {
          lines.push(`Data Retention: ${data.dataRetention.period}${data.dataRetention.conditions ? ` (${data.dataRetention.conditions})` : ''}`);
        }
        if (data.rawComplianceSections && typeof data.rawComplianceSections === 'object') {
          for (const [section, text] of Object.entries(data.rawComplianceSections)) {
            if (typeof text === 'string') {
              lines.push(`\n${section}:\n${text.slice(0, 400)}`);
            }
          }
        }
        break;

      case 'risk':
        if (data.overallScore !== undefined) {
          lines.push(`Overall Risk Score: ${data.overallScore}/100 (${data.riskLevel || 'unknown'})`);
        }
        if (Array.isArray(data.riskFactors)) {
          lines.push('Risk Factors:');
          for (const risk of data.riskFactors.slice(0, 10)) {
            lines.push(`  - [${risk.category}] ${risk.severity}: ${risk.description}`);
            if (risk.mitigation) lines.push(`    Mitigation: ${risk.mitigation}`);
            if (risk.affectedParty) lines.push(`    Affects: ${risk.affectedParty}`);
          }
        }
        if (Array.isArray(data.redFlags)) {
          lines.push('Red Flags:');
          for (const flag of data.redFlags) {
            lines.push(`  - ${flag.flag} (${flag.severity || 'high'})`);
          }
        }
        if (Array.isArray(data.favorableTerms)) {
          lines.push('Favorable Terms:');
          for (const term of data.favorableTerms) {
            lines.push(`  - ${term.term}: ${term.benefit}`);
          }
        }
        if (Array.isArray(data.compoundRisks)) {
          lines.push('Compound Risks:');
          for (const cr of data.compoundRisks) {
            lines.push(`  - ${cr.description} | Combined Impact: ${cr.combinedImpact}`);
          }
        }
        if (data.riskByParty && typeof data.riskByParty === 'object') {
          lines.push('Risk by Party:');
          for (const [party, info] of Object.entries(data.riskByParty)) {
            if (typeof info === 'object' && info !== null) {
              const partyInfo = info as { riskScore?: number };
              lines.push(`  - ${party}: ${partyInfo.riskScore || 0}/100`);
            }
          }
        }
        if (Array.isArray(data.recommendations)) {
          for (const rec of data.recommendations.slice(0, 8)) {
            lines.push(`  - ${rec}`);
          }
        }
        if (data.rawRiskClauses && typeof data.rawRiskClauses === 'object') {
          lines.push('Risky Clauses (verbatim):');
          for (const [key, text] of Object.entries(data.rawRiskClauses)) {
            if (typeof text === 'string') {
              lines.push(`  ${key}: "${text.slice(0, 200)}"`);
            }
          }
        }
        break;

      case 'financial':
        if (data.totalValue?.value) lines.push(`Total Contract Value: $${Number(data.totalValue.value).toLocaleString()}`);
        if (data.currency?.value) lines.push(`Currency: ${data.currency.value}`);
        if (Array.isArray(data.paymentTerms)) {
          lines.push('Payment Terms:');
          for (const term of data.paymentTerms) {
            lines.push(`  - ${term.value || term}`);
          }
        }
        if (Array.isArray(data.costBreakdown)) {
          lines.push('Cost Breakdown:');
          for (const cost of data.costBreakdown.slice(0, 15)) {
            lines.push(`  - ${cost.category}: $${Number(cost.amount).toLocaleString()} - ${cost.description || ''}`);
          }
        }
        if (Array.isArray(data.financialTables)) {
          for (const table of data.financialTables) {
            lines.push(`\nFinancial Table: ${table.tableName || 'Pricing Table'}`);
            if (Array.isArray(table.rows)) {
              for (const row of table.rows.slice(0, 20)) {
                const desc = row.service || row.description || row.item || 'Item';
                const total = row.lineTotal ? `$${Number(row.lineTotal).toLocaleString()}` : '';
                lines.push(`  - ${desc}: ${total}`);
              }
            }
            if (table.grandTotal?.amount) {
              lines.push(`  Grand Total: $${Number(table.grandTotal.amount).toLocaleString()}`);
            }
          }
        }
        if (Array.isArray(data.offers)) {
          for (const offer of data.offers) {
            lines.push(`\nOffer: ${offer.offerName || 'Quote'}`);
            if (offer.totalAmount) lines.push(`  Total: $${Number(offer.totalAmount).toLocaleString()}`);
            if (Array.isArray(offer.lineItems)) {
              for (const item of offer.lineItems.slice(0, 15)) {
                lines.push(`  - ${item.description}: $${Number(item.total).toLocaleString()}`);
              }
            }
          }
        }
        if (Array.isArray(data.yearlyBreakdown) && data.yearlyBreakdown.length > 0) {
          lines.push('Yearly Breakdown:');
          for (const yb of data.yearlyBreakdown) {
            const amount = yb.amount ? `$${Number(yb.amount).toLocaleString()}` : '';
            lines.push(`  - ${yb.year || yb.period || 'Year'}: ${amount}`);
          }
        }
        if (Array.isArray(data.paymentSchedule) && data.paymentSchedule.length > 0) {
          lines.push('Payment Schedule:');
          for (const ps of data.paymentSchedule.slice(0, 10)) {
            const date = ps.dueDate || ps.date || ps.milestone || 'TBD';
            const amount = ps.amount ? `$${Number(ps.amount).toLocaleString()}` : '';
            lines.push(`  - ${date}: ${amount}`);
          }
        }
        break;

      case 'obligations':
        if (Array.isArray(data.obligations)) {
          lines.push('Contractual Obligations:');
          for (const ob of data.obligations.slice(0, 20)) {
            const party = ob.party || ob.responsibleParty || 'party';
            const freq = ob.frequency ? ` (${ob.frequency})` : '';
            const deadline = ob.dueDate || ob.deadline;
            const deadlineStr = deadline ? ` - Due: ${deadline}` : '';
            lines.push(`  - [${party}] ${ob.obligation || ob.description || ''}${freq}${deadlineStr}`);
          }
        }
        if (Array.isArray(data.milestones)) {
          lines.push('Milestones:');
          for (const ms of data.milestones.slice(0, 15)) {
            const payment = ms.paymentAmount || ms.associatedPayment;
            const paymentStr = payment ? ` - $${Number(payment).toLocaleString()}` : '';
            lines.push(`  - ${ms.name || ms.title || 'Milestone'}: ${ms.dueDate || 'No date'}${paymentStr}`);
          }
        }
        if (Array.isArray(data.slaMetrics)) {
          lines.push('SLA Metrics:');
          for (const sla of data.slaMetrics.slice(0, 10)) {
            lines.push(`  - ${sla.metric}: ${sla.target}`);
          }
        }
        if (Array.isArray(data.deliverables)) {
          lines.push('Deliverables:');
          for (const del of data.deliverables.slice(0, 15)) {
            lines.push(`  - ${del.name}${del.frequency ? ` (${del.frequency})` : ''}`);
          }
        }
        break;

      case 'renewal':
        if (typeof data.autoRenewal === 'boolean') {
          lines.push(`Auto-Renewal: ${data.autoRenewal ? 'Yes' : 'No'}`);
        } else if (data.autoRenewal?.enabled !== undefined) {
          lines.push(`Auto-Renewal: ${data.autoRenewal.enabled ? 'Yes' : 'No'}`);
          if (data.autoRenewal.renewalPeriod) lines.push(`  Renewal Period: ${data.autoRenewal.renewalPeriod}`);
        }
        if (data.renewalTerms) lines.push(`Renewal Terms: ${data.renewalTerms}`);
        if (data.noticeRequirements) {
          const nr = data.noticeRequirements;
          if (nr.noticePeriod) lines.push(`Notice Period: ${nr.noticePeriod}`);
          if (nr.noticeMethod) lines.push(`Method: ${nr.noticeMethod}`);
        }
        if (data.terminationRights) {
          const tr = data.terminationRights;
          if (tr.forCause) lines.push(`Termination For Cause: ${tr.forCause}`);
          if (tr.forConvenience) lines.push(`Termination For Convenience: ${tr.forConvenience}`);
          if (tr.noticePeriod) lines.push(`Notice Period: ${tr.noticePeriod}`);
        }
        if (data.earlyTerminationFees) lines.push(`Early Termination Fees: ${data.earlyTerminationFees}`);
        if (data.terminationNotice?.requiredDays) lines.push(`Termination Notice: ${data.terminationNotice.requiredDays} days`);
        if (data.expirationDate) lines.push(`Expiration Date: ${data.expirationDate}`);
        if (data.priceEscalation?.allowed) {
          lines.push(`Price Escalation: Up to ${data.priceEscalation.maxPercentage || data.priceEscalation.cap}%`);
        }
        if (Array.isArray(data.optOutDeadlines)) {
          lines.push('Opt-Out Deadlines:');
          for (const opt of data.optOutDeadlines) {
            lines.push(`  - ${opt.action}: ${opt.deadline || `${opt.daysBeforeExpiration} days before`}`);
          }
        }
        if (Array.isArray(data.renewalAlerts)) {
          for (const alert of data.renewalAlerts) {
            lines.push(`  - [${alert.type}] ${alert.description}`);
          }
        }
        break;

      case 'negotiation_points':
      case 'negotiation':
        if (Array.isArray(data.negotiationPoints)) {
          lines.push('Negotiation Points:');
          for (const np of data.negotiationPoints.slice(0, 10)) {
            lines.push(`  - [${np.priority || 'medium'}] ${np.clause}: ${np.concern || np.issue}`);
            if (np.suggestedChange) lines.push(`    Suggested: ${np.suggestedChange}`);
          }
        }
        if (Array.isArray(data.leveragePoints)) {
          lines.push('Leverage Points:');
          for (const lp of data.leveragePoints.slice(0, 10)) {
            lines.push(`  - [${lp.priority}] ${lp.clause}: ${lp.issue}`);
          }
        }
        if (Array.isArray(data.weakClauses)) {
          lines.push('Weak Clauses:');
          for (const wc of data.weakClauses.slice(0, 8)) {
            lines.push(`  - ${wc.clauseType}: ${wc.weakness}`);
          }
        }
        if (Array.isArray(data.missingProtections)) {
          lines.push('Missing Protections:');
          for (const mp of data.missingProtections.slice(0, 8)) {
            const label = typeof mp === 'string' ? mp : `[${mp.importance || 'medium'}] ${mp.protection}`;
            lines.push(`  - ${label}`);
          }
        }
        if (data.favorabilityScore !== undefined) lines.push(`Favorability Score: ${data.favorabilityScore}/100`);
        if (data.negotiationStrategy) {
          lines.push('Strategy:');
          if (data.negotiationStrategy.openingPosition) lines.push(`  Opening: ${data.negotiationStrategy.openingPosition}`);
          if (Array.isArray(data.negotiationStrategy.mustHaves)) lines.push(`  Must-Haves: ${data.negotiationStrategy.mustHaves.join(', ')}`);
        }
        break;

      case 'amendments':
        if (data.hasAmendments !== undefined) lines.push(`Has Amendments: ${data.hasAmendments ? 'Yes' : 'No'}`);
        if (Array.isArray(data.amendments)) {
          lines.push('Contract Amendments:');
          for (const am of data.amendments.slice(0, 10)) {
            const id = am.number || am.amendmentNumber || am.id || 'Unknown';
            lines.push(`  - Amendment #${id}: ${am.summary || am.title || 'No description'}`);
            if (am.date || am.effectiveDate) lines.push(`    Date: ${am.date || am.effectiveDate}`);
          }
        }
        if (Array.isArray(data.changes)) {
          lines.push('Changes:');
          for (const ch of data.changes.slice(0, 15)) {
            lines.push(`  - [${ch.changeType}] ${ch.affectedSection}`);
          }
        }
        if (data.currentVersionInfo) {
          lines.push(`Version: ${data.currentVersionInfo.totalAmendments} amendments since ${data.currentVersionInfo.masterAgreementDate || 'original'}`);
        }
        break;

      case 'contacts':
        const contactList = data.contacts || data.primaryContacts || [];
        if (Array.isArray(contactList) && contactList.length > 0) {
          lines.push('Contacts:');
          for (const contact of contactList.slice(0, 15)) {
            const partyLabel = contact.partyType || contact.party || contact.organization || '';
            lines.push(`  - [${partyLabel}] ${contact.name}${contact.role ? `, ${contact.role}` : ''}`);
            if (contact.email) lines.push(`    Email: ${contact.email}`);
            if (contact.phone) lines.push(`    Phone: ${contact.phone}`);
          }
        }
        if (Array.isArray(data.signatories)) {
          lines.push('Signatories:');
          for (const sig of data.signatories.slice(0, 10)) {
            lines.push(`  - ${sig.name}${sig.title ? `, ${sig.title}` : ''} at ${sig.organization || 'N/A'}`);
          }
        }
        if (Array.isArray(data.escalationPath)) {
          lines.push('Escalation Path:');
          for (const esc of data.escalationPath) {
            lines.push(`  Level ${esc.level}: ${esc.role} - ${esc.responseTime || 'No SLA'}`);
          }
        }
        break;

      case 'parties':
        if (Array.isArray(data.parties)) {
          for (const party of data.parties) {
            lines.push(`${party.name} (${party.role})`);
            if (party.jurisdiction) lines.push(`  Jurisdiction: ${party.jurisdiction}`);
            if (party.address) lines.push(`  Address: ${party.address}`);
          }
        }
        break;

      case 'timeline':
        if (Array.isArray(data.events || data.timeline)) {
          const events = data.events || data.timeline;
          lines.push('Timeline:');
          for (const e of events.slice(0, 20)) {
            lines.push(`  - ${e.date || e.dueDate || 'TBD'}: ${e.event || e.description || e.title}`);
          }
        }
        break;

      case 'executive_summary':
        if (data.summary) lines.push(typeof data.summary === 'string' ? data.summary : data.summary.value || JSON.stringify(data.summary));
        if (Array.isArray(data.keyPoints)) {
          lines.push('Key Points:');
          for (const kp of data.keyPoints.slice(0, 10)) {
            lines.push(`  - ${typeof kp === 'string' ? kp : kp.point || kp.value}`);
          }
        }
        if (Array.isArray(data.recommendations)) {
          lines.push('Recommendations:');
          for (const rec of data.recommendations.slice(0, 5)) {
            lines.push(`  - ${rec}`);
          }
        }
        break;

      default:
        // Generic JSON serialization for unknown types
        const stringified = JSON.stringify(data).slice(0, 500);
        lines.push(stringified);
    }

    return lines.join('\n');
  }

  /**
   * Build a text summary of all artifacts for embedding.
   * @deprecated Kept for backward compatibility — new code uses buildSingleArtifactText per type.
   */
  private buildArtifactSummary(artifacts: any[]): string {
    if (!artifacts || artifacts.length === 0) return '';
    const lines: string[] = ['EXTRACTED ARTIFACTS:'];
    for (const artifact of artifacts) {
      const data = artifact.data as any;
      if (!data) continue;
      const artifactType = (artifact.type || artifact.artifactType || '').toLowerCase();
      if (!artifactType) continue;
      lines.push(`\n[${artifactType.toUpperCase()}]`);
      const text = this.buildSingleArtifactText(artifactType, data);
      if (text) lines.push(text);
    }
    return lines.join('\n');
  }

  /**
   * Build a text summary of contract metadata (from Contract.metadata JSON field)
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
   * Build a rich text summary from the ContractMetadata model.
   * This indexes fields like riskScore, complianceStatus, department,
   * AI insights, negotiation status, and performance tracking —
   * data that was previously NOT available to RAG search.
   */
  private buildRichContractMetadata(cm: any): string {
    if (!cm) return '';

    const lines: string[] = ['RICH CONTRACT METADATA:'];

    // Organization & Classification
    if (cm.department) lines.push(`Department: ${cm.department}`);
    if (cm.businessUnit) lines.push(`Business Unit: ${cm.businessUnit}`);
    if (cm.costCenter) lines.push(`Cost Center: ${cm.costCenter}`);
    if (cm.projectCode) lines.push(`Project Code: ${cm.projectCode}`);
    if (cm.priority !== undefined && cm.priority > 0) {
      const priorityLabels = ['normal', 'low', 'medium', 'high', 'critical'];
      lines.push(`Priority: ${priorityLabels[cm.priority] || cm.priority}`);
    }
    if (cm.importance) lines.push(`Importance: ${cm.importance}`);

    // Compliance & Audit
    if (cm.complianceStatus) lines.push(`Compliance Status: ${cm.complianceStatus}`);
    if (cm.lastAuditDate) lines.push(`Last Audit: ${new Date(cm.lastAuditDate).toISOString().split('T')[0]}`);
    if (cm.nextAuditDate) lines.push(`Next Audit: ${new Date(cm.nextAuditDate).toISOString().split('T')[0]}`);
    if (cm.auditNotes) lines.push(`Audit Notes: ${cm.auditNotes}`);

    // Analytics Scores
    if (cm.riskScore) lines.push(`Risk Score: ${cm.riskScore}/100`);
    if (cm.valueScore) lines.push(`Value Score: ${cm.valueScore}/100`);
    if (cm.complexityScore) lines.push(`Complexity Score: ${cm.complexityScore}/100`);

    // Renewal Tracking
    if (cm.renewalPriority && cm.renewalPriority !== 'NORMAL') lines.push(`Renewal Priority: ${cm.renewalPriority}`);
    if (cm.renewalDeadline) lines.push(`Renewal Deadline: ${new Date(cm.renewalDeadline).toISOString().split('T')[0]}`);
    if (cm.renewalCount > 0) lines.push(`Times Renewed: ${cm.renewalCount}`);

    // Negotiation Tracking
    if (cm.negotiationStatus) lines.push(`Negotiation Status: ${cm.negotiationStatus}`);
    if (cm.negotiationRound > 0) lines.push(`Negotiation Round: ${cm.negotiationRound}`);
    if (cm.negotiationNotes) lines.push(`Negotiation Notes: ${cm.negotiationNotes.slice(0, 300)}`);

    // Performance Tracking
    if (cm.performanceScore) lines.push(`Performance Score: ${cm.performanceScore}/100`);
    if (cm.slaComplianceRate) lines.push(`SLA Compliance Rate: ${cm.slaComplianceRate}%`);
    if (cm.issueCount > 0) lines.push(`Issues: ${cm.activeIssues || 0} active / ${cm.resolvedIssues || 0} resolved (${cm.issueCount} total)`);
    if (cm.performanceNotes) lines.push(`Performance Notes: ${cm.performanceNotes.slice(0, 300)}`);

    // AI Insights
    if (cm.aiSummary) lines.push(`AI Summary: ${cm.aiSummary.slice(0, 500)}`);
    if (Array.isArray(cm.aiKeyInsights) && cm.aiKeyInsights.length > 0) {
      lines.push('AI Key Insights:');
      for (const insight of cm.aiKeyInsights.slice(0, 8)) {
        lines.push(`  - ${typeof insight === 'string' ? insight : JSON.stringify(insight)}`);
      }
    }
    if (Array.isArray(cm.aiRiskFactors) && cm.aiRiskFactors.length > 0) {
      lines.push('AI Risk Factors:');
      for (const risk of cm.aiRiskFactors.slice(0, 8)) {
        lines.push(`  - ${typeof risk === 'string' ? risk : JSON.stringify(risk)}`);
      }
    }
    if (Array.isArray(cm.aiRecommendations) && cm.aiRecommendations.length > 0) {
      lines.push('AI Recommendations:');
      for (const rec of cm.aiRecommendations.slice(0, 8)) {
        lines.push(`  - ${typeof rec === 'string' ? rec : JSON.stringify(rec)}`);
      }
    }

    // Search Keywords
    if (Array.isArray(cm.searchKeywords) && cm.searchKeywords.length > 0) {
      lines.push(`Search Keywords: ${cm.searchKeywords.join(', ')}`);
    }

    // Tags
    if (Array.isArray(cm.tags) && cm.tags.length > 0) {
      lines.push(`Tags: ${cm.tags.join(', ')}`);
    }

    // Lifecycle
    if (cm.reviewDate) lines.push(`Review Date: ${new Date(cm.reviewDate).toISOString().split('T')[0]}`);
    if (cm.archiveDate) lines.push(`Archive Date: ${new Date(cm.archiveDate).toISOString().split('T')[0]}`);
    if (cm.expirationAction) lines.push(`Expiration Action: ${cm.expirationAction}`);

    return lines.length > 1 ? lines.join('\n') : '';
  }

  /**
   * Generate embedding for text using OpenAI.
   * Respects RAG_EMBED_MODEL and RAG_EMBED_DIMENSIONS env vars
   * for Matryoshka dimension reduction (e.g. 1024d with text-embedding-3-large).
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.includes('your-') || apiKey.length < 20) {
        logger.warn('OpenAI API key not configured or invalid');
        return null;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });
      
      const model = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';
      const dims = parseInt(process.env.RAG_EMBED_DIMENSIONS || '0', 10);
      const createParams: Record<string, unknown> = {
        model,
        input: text.slice(0, 8000), // Limit to model max
      };
      // Enable Matryoshka dimension reduction for text-embedding-3-* models
      if (dims > 0 && model.includes('text-embedding-3')) {
        createParams.dimensions = dims;
      }
      const response = await openai.embeddings.create(createParams as any);

      return response.data[0]?.embedding || null;
    } catch (error: any) {
      // Handle specific OpenAI errors
      if (error?.code === 'insufficient_quota' || error?.status === 429) {
        logger.warn({ 
          code: error?.code,
          message: 'OpenAI quota exceeded - embedding skipped, text will be stored without vector' 
        }, 'OpenAI quota exceeded');
        return null;
      }
      
      if (error?.code === 'invalid_api_key' || error?.status === 401) {
        logger.error({ code: error?.code }, 'Invalid OpenAI API key');
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, 'Failed to generate embedding');
      return null;
    }
  }
}

export const ragIntegrationService = RagIntegrationService.getInstance();
