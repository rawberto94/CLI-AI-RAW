#!/usr/bin/env npx tsx
/**
 * Enhance Chatbot Knowledge Script
 * 
 * Implements all recommendations to maximize chatbot awareness:
 * 1. Classify existing contracts with taxonomy
 * 2. Index artifacts into RAG embeddings
 * 3. Seed episodic memory with initial knowledge
 * 4. Populate clause library from extracted clauses
 * 5. Re-index contracts with enriched data
 * 
 * Run with: npx tsx scripts/enhance-chatbot-knowledge.ts
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Load OpenAI from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'text-embedding-3-small';
const EMBED_DIMENSIONS = parseInt(process.env.RAG_EMBED_DIMENSIONS || '1536', 10);

// =============================================================================
// STEP 1: CLASSIFY CONTRACTS WITH TAXONOMY
// =============================================================================

async function classifyContracts() {
  console.log('\n📋 STEP 1: Classifying contracts with taxonomy...\n');

  const contracts = await prisma.contract.findMany({
    where: {
      contractCategoryId: null, // Only unclassified
    },
    select: {
      id: true,
      fileName: true,
      rawText: true,
      tenantId: true,
      contractType: true,
      contractTitle: true,
    },
  });

  console.log(`Found ${contracts.length} unclassified contracts`);

  for (const contract of contracts) {
    try {
      console.log(`\n🔍 Classifying: ${contract.fileName}`);

      const textForClassification = contract.rawText || contract.contractTitle || contract.fileName;
      
      // Use OpenAI to classify
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a contract classification expert. Classify the contract into ONE of these categories:
- master_agreement: Master Service Agreements (MSA), Framework Agreements
- services_delivery: Statement of Work (SOW), Service Agreements, Consulting Agreements
- professional_services: Consulting, Advisory, Implementation services
- technology: Software licenses, SaaS, Technology agreements
- nda_confidentiality: NDAs, Confidentiality Agreements
- employment: Employment contracts, Contractor agreements
- procurement: Purchase orders, Vendor agreements
- licensing_ip: IP licenses, Patent agreements
- financial: Loan agreements, Investment contracts
- real_estate: Lease agreements, Property contracts
- partnership: Joint ventures, Partnership agreements

Respond with JSON: {"category_id": "...", "subtype": "...", "confidence": 0.0-1.0, "reasoning": "..."}`
          },
          {
            role: 'user',
            content: `Classify this contract:\n\nFilename: ${contract.fileName}\n\nContent:\n${textForClassification?.substring(0, 3000)}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      console.log(`   Category: ${result.category_id}`);
      console.log(`   Subtype: ${result.subtype || 'N/A'}`);
      console.log(`   Confidence: ${((result.confidence || 0) * 100).toFixed(1)}%`);

      // Update contract with classification
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          contractCategoryId: result.category_id,
          contractSubtype: result.subtype,
          documentRole: 'execution_document',
          classificationConf: result.confidence,
          classifiedAt: new Date(),
          classificationMeta: {
            reasoning: result.reasoning,
            classifier: 'enhance-chatbot-knowledge-v1',
            classifiedAt: new Date().toISOString(),
          },
        },
      });

      console.log(`   ✅ Classification saved`);

    } catch (error) {
      console.error(`   ❌ Error classifying ${contract.fileName}:`, error);
    }
  }
}

// =============================================================================
// STEP 2: INDEX ARTIFACTS INTO RAG
// =============================================================================

async function indexArtifactsIntoRAG() {
  console.log('\n📊 STEP 2: Indexing artifacts into RAG embeddings...\n');

  // Get all artifacts that might not be indexed
  const artifacts = await prisma.artifact.findMany({
    include: {
      contract: {
        select: { id: true, fileName: true, tenantId: true },
      },
    },
  });

  console.log(`Found ${artifacts.length} artifacts to process`);

  // Group artifacts by contract
  const artifactsByContract = new Map<string, typeof artifacts>();
  for (const artifact of artifacts) {
    const existing = artifactsByContract.get(artifact.contractId) || [];
    existing.push(artifact);
    artifactsByContract.set(artifact.contractId, existing);
  }

  for (const [contractId, contractArtifacts] of artifactsByContract) {
    try {
      const contract = contractArtifacts[0]?.contract;
      console.log(`\n📄 Processing artifacts for: ${contract?.fileName}`);

      // Build artifact summary text
      let artifactText = '=== EXTRACTED CONTRACT DATA ===\n\n';

      for (const artifact of contractArtifacts) {
        const data = artifact.data as Record<string, unknown>;
        artifactText += `## ${artifact.type}\n`;
        artifactText += formatArtifactData(artifact.type, data);
        artifactText += '\n\n';
      }

      // Check if metadata embedding already exists
      const existingMetaChunk = await prisma.contractEmbedding.findFirst({
        where: {
          contractId,
          chunkType: 'metadata',
        },
      });

      // Generate embedding for artifact summary
      const embedding = await generateEmbedding(artifactText);
      const embeddingVector = `[${embedding.join(',')}]`;

      if (existingMetaChunk) {
        // Update existing using raw SQL for vector type
        await prisma.$executeRaw`
          UPDATE "ContractEmbedding" 
          SET "chunkText" = ${artifactText}, embedding = ${embeddingVector}::vector, "updatedAt" = NOW()
          WHERE id = ${existingMetaChunk.id}
        `;
        console.log(`   ✅ Updated existing metadata embedding`);
      } else {
        // Create new using raw SQL for vector type
        const maxIndex = await prisma.contractEmbedding.aggregate({
          where: { contractId },
          _max: { chunkIndex: true },
        });
        
        const newChunkIndex = (maxIndex._max.chunkIndex || 0) + 1;
        const embeddingId = `emb_${crypto.randomUUID()}`;

        await prisma.$executeRaw`
          INSERT INTO "ContractEmbedding" (id, "contractId", "chunkIndex", "chunkText", "chunkType", section, embedding, "createdAt", "updatedAt")
          VALUES (${embeddingId}, ${contractId}, ${newChunkIndex}, ${artifactText}, 'metadata', 'Extracted Artifacts', ${embeddingVector}::vector, NOW(), NOW())
        `;
        console.log(`   ✅ Created new metadata embedding`);
      }

    } catch (error) {
      console.error(`   ❌ Error indexing artifacts for ${contractId}:`, error);
    }
  }
}

function formatArtifactData(type: string, data: Record<string, unknown>): string {
  // Remove _meta field for cleaner text
  const { _meta, ...cleanData } = data;
  
  switch (type) {
    case 'OVERVIEW':
      return `Contract Title: ${cleanData.contractTitle || 'N/A'}
Parties: ${JSON.stringify(cleanData.parties || [])}
Effective Date: ${cleanData.effectiveDate || 'N/A'}
Expiration Date: ${cleanData.expirationDate || 'N/A'}
Summary: ${cleanData.summary || 'N/A'}`;

    case 'FINANCIAL':
      return `Total Value: ${cleanData.totalValue || 'N/A'} ${cleanData.currency || ''}
Payment Terms: ${cleanData.paymentTerms || 'N/A'}
Billing Schedule: ${cleanData.billingSchedule || 'N/A'}
Rate Card: ${JSON.stringify(cleanData.rateCard || [])}`;

    case 'OBLIGATIONS':
      const obligations = cleanData.obligations as Array<{party?: string; obligation?: string; deadline?: string}> || [];
      return obligations.map(o => `- ${o.party}: ${o.obligation} (Due: ${o.deadline || 'Ongoing'})`).join('\n');

    case 'RISK':
      return `Risk Level: ${cleanData.overallRiskLevel || 'N/A'}
Key Risks: ${JSON.stringify(cleanData.keyRisks || [])}
Mitigations: ${JSON.stringify(cleanData.mitigations || [])}`;

    case 'CLAUSES':
      const clauses = cleanData.clauses as Array<{name?: string; summary?: string}> || [];
      return clauses.map(c => `- ${c.name}: ${c.summary}`).join('\n');

    case 'CONTACTS':
      const contacts = cleanData.contacts as Array<{name?: string; role?: string; email?: string}> || [];
      return contacts.map(c => `- ${c.name} (${c.role}): ${c.email || 'N/A'}`).join('\n');

    default:
      return JSON.stringify(cleanData, null, 2).substring(0, 1000);
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: text.substring(0, 8000), // Limit input
    dimensions: EMBED_DIMENSIONS,
  });
  return response.data[0].embedding;
}

// =============================================================================
// STEP 3: SEED EPISODIC MEMORY
// =============================================================================

async function seedEpisodicMemory() {
  console.log('\n🧠 STEP 3: Seeding episodic memory with initial knowledge...\n');

  // Get contract data to create foundational memories
  const contracts = await prisma.contract.findMany({
    include: {
      artifacts: true,
    },
  });

  const tenantId = contracts[0]?.tenantId || 'demo';
  const systemUserId = 'system';

  // Create foundational memories based on contract data
  const memories: Array<{
    type: 'insight' | 'fact' | 'preference';
    content: string;
    importance: number;
    tags: string[];
  }> = [];

  // Aggregate contract insights
  const categories = new Set<string>();
  const suppliers = new Set<string>();
  let totalValue = 0;

  for (const contract of contracts) {
    if (contract.contractCategoryId) categories.add(contract.contractCategoryId);
    if (contract.supplierName) suppliers.add(contract.supplierName);

    // Extract financial info from artifacts
    const financialArtifact = contract.artifacts.find(a => a.type === 'FINANCIAL');
    if (financialArtifact) {
      const data = financialArtifact.data as Record<string, unknown>;
      if (typeof data.totalValue === 'number') {
        totalValue += data.totalValue;
      }
    }
  }

  // Create summary memories
  if (contracts.length > 0) {
    memories.push({
      type: 'fact',
      content: `The system currently manages ${contracts.length} contract(s).`,
      importance: 0.9,
      tags: ['contracts', 'overview'],
    });
  }

  if (categories.size > 0) {
    memories.push({
      type: 'fact',
      content: `Active contract categories: ${Array.from(categories).join(', ')}.`,
      importance: 0.8,
      tags: ['categories', 'taxonomy'],
    });
  }

  if (suppliers.size > 0) {
    memories.push({
      type: 'fact',
      content: `Known suppliers: ${Array.from(suppliers).join(', ')}.`,
      importance: 0.7,
      tags: ['suppliers', 'vendors'],
    });
  }

  if (totalValue > 0) {
    memories.push({
      type: 'insight',
      content: `Total contract portfolio value is approximately $${totalValue.toLocaleString()}.`,
      importance: 0.85,
      tags: ['financial', 'portfolio'],
    });
  }

  // Add system capability memories
  memories.push({
    type: 'fact',
    content: 'I can analyze contracts using AI to extract key terms, obligations, risks, and financial data.',
    importance: 0.95,
    tags: ['capabilities', 'ai'],
  });

  memories.push({
    type: 'fact',
    content: 'I can compare contracts, track expirations, and identify renewal opportunities.',
    importance: 0.9,
    tags: ['capabilities', 'comparison'],
  });

  memories.push({
    type: 'preference',
    content: 'When asked about contracts, provide specific details with source citations.',
    importance: 0.85,
    tags: ['behavior', 'response-style'],
  });

  // Store memories
  for (const memory of memories) {
    try {
      const existingMemory = await prisma.aiMemory.findFirst({
        where: {
          tenantId,
          content: memory.content,
        },
      });

      if (!existingMemory) {
        await prisma.aiMemory.create({
          data: {
            id: `mem_${crypto.randomUUID()}`,
            userId: systemUserId,
            tenantId,
            type: memory.type,
            content: memory.content,
            importance: memory.importance,
            tags: memory.tags,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`   ✅ Created memory: "${memory.content.substring(0, 50)}..."`);
      } else {
        console.log(`   ⏭️  Memory already exists: "${memory.content.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.error(`   ❌ Error creating memory:`, error);
    }
  }

  const memoryCount = await prisma.aiMemory.count({ where: { tenantId } });
  console.log(`\n   📊 Total memories in system: ${memoryCount}`);
}

// =============================================================================
// STEP 4: POPULATE CLAUSE LIBRARY
// =============================================================================

async function populateClauseLibrary() {
  console.log('\n📚 STEP 4: Populating clause library from extracted clauses...\n');

  // Get all CLAUSES artifacts
  const clauseArtifacts = await prisma.artifact.findMany({
    where: { type: 'CLAUSES' },
    include: {
      contract: {
        select: { id: true, fileName: true, tenantId: true },
      },
    },
  });

  console.log(`Found ${clauseArtifacts.length} clause artifacts`);

  let clausesAdded = 0;

  for (const artifact of clauseArtifacts) {
    try {
      const data = artifact.data as Record<string, unknown>;
      const clauses = (data.clauses || data.keyClauses || []) as Array<{
        name?: string;
        type?: string;
        text?: string;
        summary?: string;
        source?: string;
      }>;

      for (const clause of clauses) {
        if (!clause.name && !clause.type) continue;

        const clauseName = clause.name || clause.type || 'Unknown Clause';
        const clauseType = normalizeClauseType(clauseName);

        // Check if similar clause exists
        const existingClause = await prisma.clauseLibrary.findFirst({
          where: {
            tenantId: artifact.contract.tenantId,
            name: { contains: clauseName, mode: 'insensitive' },
          },
        });

        if (!existingClause) {
          await prisma.clauseLibrary.create({
            data: {
              id: `clause_${crypto.randomUUID()}`,
              tenantId: artifact.contract.tenantId,
              name: clauseName,
              type: clauseType,
              text: clause.text || clause.summary || '',
              summary: clause.summary || '',
              sourceContractId: artifact.contract.id,
              usageCount: 1,
              isStandard: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          clausesAdded++;
          console.log(`   ✅ Added clause: ${clauseName}`);
        } else {
          // Update usage count
          await prisma.clauseLibrary.update({
            where: { id: existingClause.id },
            data: {
              usageCount: { increment: 1 },
              updatedAt: new Date(),
            },
          });
          console.log(`   ⏭️  Clause exists, updated count: ${clauseName}`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error processing clauses:`, error);
    }
  }

  console.log(`\n   📊 Total new clauses added: ${clausesAdded}`);
}

function normalizeClauseType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('termination')) return 'termination';
  if (lower.includes('confidential') || lower.includes('nda')) return 'confidentiality';
  if (lower.includes('indemn')) return 'indemnification';
  if (lower.includes('liabil')) return 'liability';
  if (lower.includes('payment') || lower.includes('fee')) return 'payment';
  if (lower.includes('ip') || lower.includes('intellectual')) return 'ip';
  if (lower.includes('warranty') || lower.includes('guarantee')) return 'warranty';
  if (lower.includes('force majeure')) return 'force_majeure';
  if (lower.includes('govern') || lower.includes('jurisd')) return 'governing_law';
  if (lower.includes('dispute') || lower.includes('arbitr')) return 'dispute_resolution';
  return 'general';
}

// =============================================================================
// STEP 5: RE-INDEX ALL CONTRACTS
// =============================================================================

async function reindexAllContracts() {
  console.log('\n🔄 STEP 5: Re-indexing all contracts with enriched data...\n');

  const contracts = await prisma.contract.findMany({
    include: {
      artifacts: true,
    },
  });

  for (const contract of contracts) {
    try {
      console.log(`\n📄 Re-indexing: ${contract.fileName}`);

      // Build comprehensive text for embedding
      let fullText = '';

      // Add contract raw text
      if (contract.rawText) {
        fullText += `=== CONTRACT TEXT ===\n${contract.rawText}\n\n`;
      }

      // Add taxonomy classification
      if (contract.contractCategoryId) {
        fullText += `=== CLASSIFICATION ===\n`;
        fullText += `Category: ${contract.contractCategoryId}\n`;
        fullText += `Subtype: ${contract.contractSubtype || 'N/A'}\n`;
        fullText += `Document Role: ${contract.documentRole || 'N/A'}\n\n`;
      }

      // Add artifact summaries
      for (const artifact of contract.artifacts) {
        const data = artifact.data as Record<string, unknown>;
        fullText += `=== ${artifact.type} ===\n`;
        fullText += formatArtifactData(artifact.type, data);
        fullText += '\n\n';
      }

      // Add metadata
      fullText += `=== METADATA ===\n`;
      fullText += `Supplier: ${contract.supplierName || 'N/A'}\n`;
      fullText += `Client: ${contract.clientName || 'N/A'}\n`;
      fullText += `Start Date: ${contract.startDate || 'N/A'}\n`;
      fullText += `End Date: ${contract.endDate || 'N/A'}\n`;

      // Chunk the text for better retrieval
      const chunks = chunkText(fullText, 1000, 100);
      console.log(`   Created ${chunks.length} chunks`);

      // Delete old embeddings
      await prisma.contractEmbedding.deleteMany({
        where: { contractId: contract.id },
      });

      // Create new embeddings using raw SQL for vector type
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbedding(chunk.text);
        const embeddingId = `emb_${crypto.randomUUID()}`;
        const embeddingVector = `[${embedding.join(',')}]`;

        // Use raw SQL to insert embedding with vector type
        await prisma.$executeRaw`
          INSERT INTO "ContractEmbedding" (id, "contractId", "chunkIndex", "chunkText", "chunkType", section, embedding, "createdAt", "updatedAt")
          VALUES (${embeddingId}, ${contract.id}, ${i}, ${chunk.text}, ${chunk.type}, ${chunk.section}, ${embeddingVector}::vector, NOW(), NOW())
        `;
      }

      // Update contract searchable text
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          searchableText: fullText.substring(0, 50000),
          lastAnalyzedAt: new Date(),
        },
      });

      console.log(`   ✅ Re-indexed with ${chunks.length} chunks`);

    } catch (error) {
      console.error(`   ❌ Error re-indexing ${contract.fileName}:`, error);
    }
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): Array<{ text: string; type: string; section: string }> {
  const chunks: Array<{ text: string; type: string; section: string }> = [];
  
  // Split by sections first
  const sections = text.split(/===\s*([A-Z\s]+)\s*===/);
  
  let currentSection = 'content';
  for (let i = 0; i < sections.length; i++) {
    const part = sections[i].trim();
    if (!part) continue;

    // Check if this is a section header
    if (part.match(/^[A-Z\s]+$/) && part.length < 50) {
      currentSection = part.toLowerCase().replace(/\s+/g, '_');
      continue;
    }

    // Chunk this section
    let start = 0;
    while (start < part.length) {
      const end = Math.min(start + chunkSize, part.length);
      const chunkText = part.substring(start, end);
      
      if (chunkText.trim().length > 50) {
        chunks.push({
          text: chunkText,
          type: currentSection === 'contract_text' ? 'content' : 'metadata',
          section: currentSection,
        });
      }
      
      start += chunkSize - overlap;
    }
  }

  return chunks.length > 0 ? chunks : [{ text: text.substring(0, chunkSize), type: 'content', section: 'full' }];
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ENHANCE CHATBOT KNOWLEDGE - FULL IMPLEMENTATION       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not set. Looking in apps/web/.env...');
      
      // Try to load from apps/web/.env
      const fs = await import('fs');
      const path = await import('path');
      const envPath = path.join(process.cwd(), 'apps/web/.env');
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/OPENAI_API_KEY="?([^"\n]+)"?/);
        if (match) {
          process.env.OPENAI_API_KEY = match[1];
          console.log('✅ Loaded OPENAI_API_KEY from apps/web/.env');
        }
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    // Run all steps
    await classifyContracts();
    await indexArtifactsIntoRAG();
    await seedEpisodicMemory();
    await populateClauseLibrary();
    await reindexAllContracts();

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ENHANCEMENT COMPLETE                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const stats = await getEnhancementStats();
    console.log('\n📊 Final Statistics:');
    console.log(`   Contracts: ${stats.contracts}`);
    console.log(`   Classified: ${stats.classified}`);
    console.log(`   RAG Embeddings: ${stats.embeddings}`);
    console.log(`   AI Memories: ${stats.memories}`);
    console.log(`   Clause Library: ${stats.clauses}`);
    console.log(`   Artifacts: ${stats.artifacts}`);

  } catch (error) {
    console.error('\n❌ Enhancement failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getEnhancementStats() {
  const [contracts, classified, embeddings, memories, clauses, artifacts] = await Promise.all([
    prisma.contract.count(),
    prisma.contract.count({ where: { contractCategoryId: { not: null } } }),
    prisma.contractEmbedding.count(),
    prisma.aiMemory.count(),
    prisma.clauseLibrary.count(),
    prisma.artifact.count(),
  ]);

  return { contracts, classified, embeddings, memories, clauses, artifacts };
}

main();
