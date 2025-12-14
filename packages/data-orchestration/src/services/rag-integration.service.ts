/**
 * RAG Integration Service
 * 
 * Handles re-indexing of contracts when artifacts or metadata change.
 * This ensures the AI chatbot always has up-to-date information.
 */

import getClient from 'clients-db';
import { createLogger } from '../utils/logger';

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

        case 'overview':
        case 'OVERVIEW':
          // Handle enhanced overview artifact with flexible fields
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
          // Flexible fields
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
            lines.push('Additional Overview Data:');
            for (const [key, value] of Object.entries(data.additionalData)) {
              if (typeof value === 'object' && (value as any)?.value) {
                lines.push(`  - ${key}: ${(value as any).value}`);
              } else if (typeof value === 'string' || typeof value === 'number') {
                lines.push(`  - ${key}: ${value}`);
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
        case 'CLAUSES':
          // Handle enhanced clauses artifact with hierarchy and raw text
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
        case 'RATES':
          // Handle enhanced rates artifact with raw tables and conditions
          if (Array.isArray(data.rateCards)) {
            lines.push('Rate Cards:');
            for (const rate of data.rateCards.slice(0, 20)) {
              const loc = rate.location ? ` (${rate.location})` : '';
              lines.push(`  - ${rate.role}: ${rate.currency || 'USD'} ${rate.rate}/${rate.unit}${loc}`);
            }
          }
          // Raw rate tables for 1:1 document fidelity
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
        case 'COMPLIANCE':
          // Handle enhanced compliance artifact
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
        case 'RISK':
          // Handle enhanced risk artifact
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
            lines.push('Compound Risks (clause interactions):');
            for (const cr of data.compoundRisks) {
              lines.push(`  - ${cr.description}`);
              lines.push(`    Combined Impact: ${cr.combinedImpact}`);
            }
          }
          if (data.riskByParty && typeof data.riskByParty === 'object') {
            lines.push('Risk by Party:');
            for (const [party, info] of Object.entries(data.riskByParty)) {
              if (typeof info === 'object' && info !== null) {
                const partyInfo = info as { riskScore?: number; riskFactors?: string[] };
                lines.push(`  - ${party}: ${partyInfo.riskScore || 0}/100`);
              }
            }
          }
          if (Array.isArray(data.recommendations)) {
            lines.push('Recommendations:');
            for (const rec of data.recommendations.slice(0, 8)) {
              lines.push(`  - ${rec}`);
            }
          }
          if (Array.isArray(data.costSavingsOpportunities)) {
            lines.push('Cost Savings Opportunities:');
            for (const opp of data.costSavingsOpportunities.slice(0, 5)) {
              lines.push(`  - ${opp}`);
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
        case 'FINANCIAL':
          // Handle financial artifact with tables, offers, and breakdowns
          if (data.totalValue?.value) {
            lines.push(`Total Contract Value: $${Number(data.totalValue.value).toLocaleString()}`);
          }
          if (data.currency?.value) {
            lines.push(`Currency: ${data.currency.value}`);
          }
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
          // Financial Tables
          if (Array.isArray(data.financialTables)) {
            for (const table of data.financialTables) {
              lines.push(`\nFinancial Table: ${table.tableName || 'Pricing Table'}`);
              if (Array.isArray(table.rows)) {
                for (const row of table.rows.slice(0, 20)) {
                  const desc = row.service || row.description || row.item || 'Item';
                  const qty = row.quantity || '';
                  const unitPrice = row.unitPrice ? `$${row.unitPrice}` : '';
                  const total = row.lineTotal ? `$${Number(row.lineTotal).toLocaleString()}` : '';
                  lines.push(`  - ${desc}: ${qty} @ ${unitPrice} = ${total}`);
                }
              }
              if (Array.isArray(table.subtotals)) {
                for (const sub of table.subtotals) {
                  lines.push(`  Subtotal (${sub.label}): $${Number(sub.amount).toLocaleString()}`);
                }
              }
              if (table.grandTotal?.amount) {
                lines.push(`  Grand Total: $${Number(table.grandTotal.amount).toLocaleString()}`);
              }
            }
          }
          // Offers/Quotes
          if (Array.isArray(data.offers)) {
            for (const offer of data.offers) {
              lines.push(`\nOffer: ${offer.offerName || 'Quote'}`);
              if (offer.validityPeriod) lines.push(`  Valid for: ${offer.validityPeriod}`);
              if (offer.totalAmount) lines.push(`  Total: $${Number(offer.totalAmount).toLocaleString()}`);
              if (Array.isArray(offer.lineItems)) {
                lines.push('  Line Items:');
                for (const item of offer.lineItems.slice(0, 15)) {
                  lines.push(`    - ${item.description}: ${item.quantity} ${item.unit || ''} @ $${item.unitPrice} = $${Number(item.total).toLocaleString()}`);
                }
              }
              if (Array.isArray(offer.terms)) {
                lines.push(`  Terms: ${offer.terms.join(', ')}`);
              }
            }
          }
          // Discounts
          if (Array.isArray(data.discounts) && data.discounts.length > 0) {
            lines.push('Discounts:');
            for (const disc of data.discounts) {
              lines.push(`  - ${disc.type}: ${disc.value}${disc.unit === 'percentage' ? '%' : ''} - ${disc.description || ''}`);
            }
          }
          break;

        case 'obligations':
        case 'OBLIGATIONS':
          // Handle obligations artifact
          if (Array.isArray(data.obligations)) {
            lines.push('Contractual Obligations:');
            for (const ob of data.obligations.slice(0, 20)) {
              const party = ob.responsibleParty || 'party';
              const freq = ob.frequency ? ` (${ob.frequency})` : '';
              const deadline = ob.deadline ? ` - Due: ${ob.deadline}` : '';
              lines.push(`  - [${party}] ${ob.description}${freq}${deadline}`);
              if (ob.penalty?.description) {
                lines.push(`    Penalty: ${ob.penalty.description}`);
              }
            }
          }
          if (Array.isArray(data.milestones)) {
            lines.push('Milestones:');
            for (const ms of data.milestones.slice(0, 15)) {
              const payment = ms.paymentAmount ? ` - $${Number(ms.paymentAmount).toLocaleString()}` : '';
              lines.push(`  - ${ms.name}: ${ms.dueDate || 'No date'}${payment}`);
              if (Array.isArray(ms.deliverables)) {
                lines.push(`    Deliverables: ${ms.deliverables.join(', ')}`);
              }
            }
          }
          if (Array.isArray(data.slaMetrics)) {
            lines.push('SLA Metrics:');
            for (const sla of data.slaMetrics.slice(0, 10)) {
              const penalty = sla.penalty?.description ? ` (Penalty: ${sla.penalty.description})` : '';
              lines.push(`  - ${sla.metric}: ${sla.target}${penalty}`);
            }
          }
          if (Array.isArray(data.deliverables)) {
            lines.push('Deliverables:');
            for (const del of data.deliverables.slice(0, 15)) {
              lines.push(`  - ${del.name}${del.frequency ? ` (${del.frequency})` : ''} - ${del.responsibleParty || ''}`);
            }
          }
          break;

        case 'renewal':
        case 'RENEWAL':
          // Handle renewal artifact
          if (data.autoRenewal) {
            lines.push(`Auto-Renewal: ${data.autoRenewal.enabled ? 'Yes' : 'No'}`);
            if (data.autoRenewal.renewalPeriod) {
              lines.push(`  Renewal Period: ${data.autoRenewal.renewalPeriod}`);
            }
          }
          if (data.terminationNotice) {
            lines.push(`Termination Notice: ${data.terminationNotice.noticePeriod} ${data.terminationNotice.noticePeriodUnit}`);
            if (data.terminationNotice.noticeMethod) {
              lines.push(`  Method: ${data.terminationNotice.noticeMethod}`);
            }
          }
          if (data.terminationForCause?.allowed) {
            lines.push(`Termination for Cause: ${data.terminationForCause.noticePeriod || ''} ${data.terminationForCause.noticePeriodUnit || ''}`);
            if (Array.isArray(data.terminationForCause.causeDefinitions)) {
              lines.push(`  Cause Definitions: ${data.terminationForCause.causeDefinitions.join('; ')}`);
            }
          }
          if (data.terminationForConvenience?.allowed) {
            lines.push(`Termination for Convenience: ${data.terminationForConvenience.noticePeriod || ''} ${data.terminationForConvenience.noticePeriodUnit || ''}`);
            if (data.terminationForConvenience.earlyTerminationFee) {
              lines.push(`  Early Termination Fee: ${data.terminationForConvenience.earlyTerminationFee.amount || data.terminationForConvenience.earlyTerminationFee.formula}`);
            }
          }
          if (data.priceEscalation?.allowed) {
            lines.push(`Price Escalation: Up to ${data.priceEscalation.maxPercentage || data.priceEscalation.cap}%${data.priceEscalation.frequency ? ` ${data.priceEscalation.frequency}` : ''}`);
            if (data.priceEscalation.indexTiedTo) {
              lines.push(`  Tied to: ${data.priceEscalation.indexTiedTo}`);
            }
          }
          if (Array.isArray(data.optOutDeadlines)) {
            lines.push('Opt-Out Deadlines:');
            for (const opt of data.optOutDeadlines) {
              lines.push(`  - ${opt.action}: ${opt.deadline || `${opt.daysBeforeExpiration} days before expiration`}`);
            }
          }
          if (Array.isArray(data.renewalAlerts)) {
            lines.push('Renewal Alerts:');
            for (const alert of data.renewalAlerts) {
              lines.push(`  - [${alert.type}] ${alert.description}${alert.date ? ` - ${alert.date}` : ''}`);
            }
          }
          if (data.lockInPeriod) {
            lines.push(`Lock-In Period: ${data.lockInPeriod.period}${data.lockInPeriod.penalty ? ` (Penalty: ${data.lockInPeriod.penalty})` : ''}`);
          }
          break;

        case 'negotiation_points':
        case 'NEGOTIATION_POINTS':
          // Handle negotiation points artifact
          if (Array.isArray(data.leveragePoints)) {
            lines.push('Negotiation Leverage Points:');
            for (const lp of data.leveragePoints.slice(0, 10)) {
              lines.push(`  - [${lp.priority}] ${lp.clause}: ${lp.issue}`);
              lines.push(`    Current: ${lp.currentPosition}`);
              lines.push(`    Suggested: ${lp.suggestedPosition}`);
            }
          }
          if (Array.isArray(data.weakClauses)) {
            lines.push('Weak Clauses:');
            for (const wc of data.weakClauses.slice(0, 8)) {
              lines.push(`  - ${wc.clauseType}: ${wc.weakness}`);
              lines.push(`    Recommendation: ${wc.recommendedChange}`);
            }
          }
          if (Array.isArray(data.missingProtections)) {
            lines.push('Missing Protections:');
            for (const mp of data.missingProtections.slice(0, 8)) {
              lines.push(`  - [${mp.importance}] ${mp.protection}`);
              if (mp.suggestedLanguage) {
                lines.push(`    Suggested: ${mp.suggestedLanguage}`);
              }
            }
          }
          if (data.negotiationStrategy) {
            lines.push('Negotiation Strategy:');
            lines.push(`  Opening Position: ${data.negotiationStrategy.openingPosition}`);
            if (Array.isArray(data.negotiationStrategy.mustHaves)) {
              lines.push(`  Must-Haves: ${data.negotiationStrategy.mustHaves.join(', ')}`);
            }
            if (Array.isArray(data.negotiationStrategy.walkAwayPoints)) {
              lines.push(`  Walk-Away Points: ${data.negotiationStrategy.walkAwayPoints.join(', ')}`);
            }
          }
          if (Array.isArray(data.prioritizedActions)) {
            lines.push('Prioritized Actions:');
            for (const pa of data.prioritizedActions.slice(0, 5)) {
              lines.push(`  ${pa.rank}. ${pa.action} (Impact: ${pa.impact}, Effort: ${pa.effort})`);
            }
          }
          break;

        case 'amendments':
        case 'AMENDMENTS':
          // Handle amendments artifact
          if (Array.isArray(data.amendments)) {
            lines.push('Contract Amendments:');
            for (const am of data.amendments.slice(0, 10)) {
              lines.push(`  - Amendment #${am.amendmentNumber || am.id}: ${am.title || am.summary}`);
              if (am.effectiveDate) lines.push(`    Effective: ${am.effectiveDate}`);
            }
          }
          if (Array.isArray(data.changes)) {
            lines.push('Changes Made:');
            for (const ch of data.changes.slice(0, 15)) {
              lines.push(`  - [${ch.changeType}] ${ch.affectedSection}`);
              if (ch.newText) lines.push(`    New: ${ch.newText.slice(0, 100)}`);
              if (ch.financialImpact) {
                lines.push(`    Financial Impact: ${ch.financialImpact.type} - ${ch.financialImpact.newValue || ''}`);
              }
            }
          }
          if (Array.isArray(data.supersededClauses)) {
            lines.push('Superseded Clauses:');
            for (const sc of data.supersededClauses) {
              lines.push(`  - ${sc.section} (replaced by ${sc.supersededBy})`);
            }
          }
          if (data.currentVersionInfo) {
            lines.push(`Current Version: ${data.currentVersionInfo.totalAmendments} amendments since ${data.currentVersionInfo.masterAgreementDate || 'original'}`);
          }
          break;

        case 'contacts':
        case 'CONTACTS':
          // Handle contacts artifact
          if (Array.isArray(data.primaryContacts)) {
            lines.push('Primary Contacts:');
            for (const contact of data.primaryContacts.slice(0, 15)) {
              lines.push(`  - [${contact.party}] ${contact.name}${contact.title ? `, ${contact.title}` : ''}`);
              if (contact.email) lines.push(`    Email: ${contact.email}`);
              if (contact.phone) lines.push(`    Phone: ${contact.phone}`);
              if (Array.isArray(contact.purpose)) {
                lines.push(`    Purpose: ${contact.purpose.join(', ')}`);
              }
            }
          }
          if (Array.isArray(data.escalationPath)) {
            lines.push('Escalation Path:');
            for (const esc of data.escalationPath) {
              lines.push(`  Level ${esc.level}: ${esc.role}${esc.contact ? ` (${esc.contact})` : ''} - ${esc.responseTime || 'No SLA'}`);
            }
          }
          if (Array.isArray(data.notificationAddresses)) {
            lines.push('Notification Addresses:');
            for (const addr of data.notificationAddresses) {
              lines.push(`  - [${addr.party}] ${addr.type}: ${addr.address} (${addr.method || 'unspecified'})`);
            }
          }
          if (Array.isArray(data.responseTimeRequirements)) {
            lines.push('Response Time Requirements:');
            for (const rt of data.responseTimeRequirements) {
              lines.push(`  - ${rt.type}${rt.level ? ` (${rt.level})` : ''}: ${rt.responseTime}`);
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
