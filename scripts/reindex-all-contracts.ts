#!/usr/bin/env npx tsx
/**
 * Re-index All Contracts — Per-Artifact Embedding Migration
 *
 * Processes all contracts through the new per-type artifact chunking scheme:
 *   - Document chunks (0..N) — Semantic chunks of raw contract text (1024-dim)
 *   - Artifact chunks (9901–9921) — One embedding per AI artifact type
 *   - Metadata chunk (9950) — Taxonomy + ContractMetadata rich fields
 *
 * Multi-tenant safe: Each embedding stores its tenantId; no cross-tenant mixing.
 *
 * Usage:
 *   pnpm tsx scripts/reindex-all-contracts.ts                  # all completed contracts
 *   pnpm tsx scripts/reindex-all-contracts.ts --limit 5        # first 5 only
 *   pnpm tsx scripts/reindex-all-contracts.ts --tenant acme    # single tenant
 *   pnpm tsx scripts/reindex-all-contracts.ts --doc-chunks     # also re-embed document text chunks
 *   pnpm tsx scripts/reindex-all-contracts.ts --dry-run        # preview without changes
 *
 * Environment:
 *   OPENAI_API_KEY          — Required
 *   RAG_EMBED_MODEL         — Default: text-embedding-3-large
 *   RAG_EMBED_DIMENSIONS    — Default: 1024 (Matryoshka)
 *   DATABASE_URL            — PostgreSQL connection string
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const docChunks = args.includes('--doc-chunks');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] || '50', 10) : 99999;
const tenantIdx = args.indexOf('--tenant');
const tenantFilter = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;

// ── Embedding config ────────────────────────────────────────────────────────
const EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'text-embedding-3-large';
const EMBED_DIMS = parseInt(process.env.RAG_EMBED_DIMENSIONS || '1024', 10);

// ── Chunk type → chunk index map (must match rag-integration.service.ts) ────
const ARTIFACT_CHUNK_OFFSETS: Record<string, number> = {
  overview: 9901,
  clauses: 9902,
  financial: 9903,
  risk: 9904,
  compliance: 9905,
  obligations: 9906,
  renewal: 9907,
  negotiation_points: 9908,
  amendments: 9909,
  contacts: 9910,
  parties: 9911,
  timeline: 9912,
  executive_summary: 9913,
  rates: 9914,
  signatures: 9915,
  termination: 9916,
  intellectual_property: 9917,
  indemnification: 9918,
  warranties: 9919,
  performance_metrics: 9920,
  data_protection: 9921,
};
const METADATA_CHUNK_INDEX = 9950;

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Contract Re-Index — Per-Artifact Embedding Migration');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Model:      ${EMBED_MODEL}`);
  console.log(`  Dimensions: ${EMBED_DIMS}`);
  console.log(`  Tenant:     ${tenantFilter || 'ALL'}`);
  console.log(`  Limit:      ${limit}`);
  console.log(`  Doc chunks: ${docChunks ? 'YES' : 'Artifact+Metadata only'}`);
  console.log(`  Dry run:    ${dryRun}`);
  console.log('');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.length < 20) {
    console.error('❌ OPENAI_API_KEY not set or invalid');
    process.exit(1);
  }

  const OpenAIModule = (await import('openai')).default;
  const openai = new OpenAIModule({ apiKey });
  const { toSql } = await import('pgvector/utils');

  // ── Verify vector column is 1024 ──────────────────────────────────────
  try {
    const colCheck: any[] = await prisma.$queryRaw`
      SELECT atttypmod FROM pg_attribute
      WHERE attrelid = '"ContractEmbedding"'::regclass
        AND attname = 'embedding';
    `;
    const typmod = colCheck?.[0]?.atttypmod;
    // pgvector stores (dims + 4) in atttypmod
    if (typmod && typmod > 0) {
      const actualDims = typmod - 4;
      if (actualDims !== EMBED_DIMS) {
        console.error(`❌ Vector column is vector(${actualDims}) but RAG_EMBED_DIMENSIONS=${EMBED_DIMS}`);
        console.error('   Run the migration first: psql < migrations/20260223000000_vector_1024_artifact_chunks/migration.sql');
        process.exit(1);
      }
      console.log(`✅ Vector column confirmed: vector(${actualDims})`);
    }
  } catch {
    console.log('⚠️  Could not verify vector column dimensions (continuing anyway)');
  }

  // ── Find contracts ────────────────────────────────────────────────────
  const where: any = {
    status: { in: ['COMPLETED', 'ACTIVE'] },
  };
  if (tenantFilter) where.tenantId = tenantFilter;

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      artifacts: true,
      contractMetadata: true,
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📄 Found ${contracts.length} contracts to process\n`);

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalEmbeddings = 0;

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    const prefix = `[${i + 1}/${contracts.length}]`;
    console.log(`${prefix} ${contract.fileName || contract.id} (tenant: ${contract.tenantId})`);

    if (dryRun) {
      const artifactTypes = (contract.artifacts || [])
        .map((a: any) => (a.type || a.artifactType || '').toLowerCase())
        .filter(Boolean);
      console.log(`       Artifacts: ${artifactTypes.join(', ') || 'none'}`);
      console.log(`       Raw text:  ${(contract.rawText || '').length} chars`);
      totalSuccess++;
      continue;
    }

    try {
      let contractEmbeddings = 0;

      // ── A. Document text chunks (if --doc-chunks) ───────────────────
      if (docChunks && contract.rawText && contract.rawText.length > 100) {
        // Delete old document chunks (0..9899)
        await prisma.$executeRawUnsafe(`
          DELETE FROM "ContractEmbedding"
          WHERE "contractId" = $1 AND "chunkIndex" < 9900
        `, contract.id);

        const chunks = semanticChunk(contract.rawText);
        for (let ci = 0; ci < chunks.length; ci += 32) {
          const batch = chunks.slice(ci, ci + 32);
          const texts = batch.map(c => c.text);

          const createParams: Record<string, unknown> = {
            model: EMBED_MODEL,
            input: texts,
          };
          if (EMBED_DIMS > 0 && EMBED_MODEL.includes('text-embedding-3')) {
            createParams.dimensions = EMBED_DIMS;
          }
          const resp = await openai.embeddings.create(createParams as any);

          for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j];
            const embVector = toSql(resp.data[j].embedding);
            await prisma.$executeRawUnsafe(`
              INSERT INTO "ContractEmbedding"
              ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, $6, $7, $8, NOW(), NOW())
              ON CONFLICT ("contractId", "chunkIndex")
              DO UPDATE SET
                "chunkText" = EXCLUDED."chunkText",
                "embedding" = EXCLUDED."embedding",
                "chunkType" = EXCLUDED."chunkType",
                "section"   = EXCLUDED."section",
                "tenantId"  = EXCLUDED."tenantId",
                "contractType" = EXCLUDED."contractType",
                "updatedAt" = NOW()
            `, contract.id, chunk.index, chunk.text, embVector,
               chunk.metadata.chunkType, chunk.metadata.section || null,
               contract.tenantId || null, contract.contractType || null);
            contractEmbeddings++;
          }
        }
        console.log(`       📝 ${contractEmbeddings} document chunks`);
      }

      // ── B. Per-artifact-type chunks ─────────────────────────────────
      const artifacts = contract.artifacts || [];
      let artifactCount = 0;

      for (const artifact of artifacts) {
        const data = artifact.data as any;
        if (!data) continue;

        const artifactType = ((artifact as any).type || (artifact as any).artifactType || '').toLowerCase();
        if (!artifactType) continue;

        const chunkIndex = ARTIFACT_CHUNK_OFFSETS[artifactType];
        if (!chunkIndex) continue;

        const text = buildSingleArtifactText(artifactType, data);
        if (!text || text.length < 20) continue;

        const chunkText = `[ARTIFACT: ${artifactType.toUpperCase()}]\n${text}`;
        const embedding = await generateEmbedding(openai, chunkText);

        if (embedding) {
          const embVector = toSql(embedding);
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ContractEmbedding"
            ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, 'metadata', $5, $6, $7, NOW(), NOW())
            ON CONFLICT ("contractId", "chunkIndex")
            DO UPDATE SET
              "chunkText" = EXCLUDED."chunkText",
              "embedding" = EXCLUDED."embedding",
              "section"   = EXCLUDED."section",
              "tenantId"  = EXCLUDED."tenantId",
              "contractType" = EXCLUDED."contractType",
              "updatedAt" = NOW()
          `, contract.id, chunkIndex, chunkText, embVector,
             `Artifact: ${artifactType.replace(/_/g, ' ')}`,
             contract.tenantId || null, contract.contractType || null);
          artifactCount++;
          contractEmbeddings++;
        }
      }
      console.log(`       🧠 ${artifactCount} artifact chunks`);

      // ── C. Metadata + taxonomy chunk ────────────────────────────────
      const metaParts: string[] = ['=== CONTRACT METADATA & TAXONOMY ==='];

      // Taxonomy context
      const taxonomyLines: string[] = [];
      if (contract.contractType) taxonomyLines.push(`Contract Type: ${contract.contractType}`);
      if (contract.contractSubtype) taxonomyLines.push(`Subtype: ${contract.contractSubtype}`);
      if (contract.documentRole) taxonomyLines.push(`Document Role: ${contract.documentRole}`);
      if (contract.contractCategoryId) taxonomyLines.push(`Category: ${contract.contractCategoryId}`);
      if (contract.supplierName) taxonomyLines.push(`Supplier: ${contract.supplierName}`);
      if (contract.clientName) taxonomyLines.push(`Client: ${contract.clientName}`);
      if (contract.totalValue) taxonomyLines.push(`Total Value: ${contract.totalValue}`);
      if (contract.currency) taxonomyLines.push(`Currency: ${contract.currency}`);
      if (contract.jurisdiction) taxonomyLines.push(`Jurisdiction: ${contract.jurisdiction}`);
      if ((contract.pricingModels as any)?.length) taxonomyLines.push(`Pricing: ${(contract.pricingModels as any).join(', ')}`);
      if ((contract.deliveryModels as any)?.length) taxonomyLines.push(`Delivery: ${(contract.deliveryModels as any).join(', ')}`);
      if ((contract.riskFlags as any)?.length) taxonomyLines.push(`Risk Flags: ${(contract.riskFlags as any).join(', ')}`);
      if (taxonomyLines.length) metaParts.push(taxonomyLines.join('\n'));

      // ContractMetadata rich fields
      const cm = contract.contractMetadata as any;
      if (cm) {
        const richParts: string[] = [];
        if (cm.department) richParts.push(`Department: ${cm.department}`);
        if (cm.businessUnit) richParts.push(`Business Unit: ${cm.businessUnit}`);
        if (cm.costCenter) richParts.push(`Cost Center: ${cm.costCenter}`);
        if (cm.priority) richParts.push(`Priority: ${cm.priority}`);
        if (cm.complianceStatus) richParts.push(`Compliance: ${cm.complianceStatus}`);
        if (cm.riskScore != null) richParts.push(`Risk Score: ${cm.riskScore}`);
        if (cm.valueScore != null) richParts.push(`Value Score: ${cm.valueScore}`);
        if (cm.complexityScore != null) richParts.push(`Complexity Score: ${cm.complexityScore}`);
        if (cm.renewalPriority) richParts.push(`Renewal Priority: ${cm.renewalPriority}`);
        if (cm.negotiationStatus) richParts.push(`Negotiation: ${cm.negotiationStatus}`);
        if (cm.performanceScore != null) richParts.push(`Performance: ${cm.performanceScore}`);
        if (cm.aiSummary) richParts.push(`AI Summary: ${cm.aiSummary}`);
        if (cm.aiKeyInsights) richParts.push(`AI Insights: ${cm.aiKeyInsights}`);
        if (cm.aiRiskFactors) richParts.push(`AI Risk Factors: ${cm.aiRiskFactors}`);
        if (cm.searchKeywords?.length) richParts.push(`Keywords: ${cm.searchKeywords.join(', ')}`);
        if (cm.tags?.length) richParts.push(`Tags: ${cm.tags.join(', ')}`);
        if (richParts.length) metaParts.push(richParts.join('\n'));
      }

      if (metaParts.length > 1) {
        const metaChunkText = metaParts.join('\n\n');
        const metaEmb = await generateEmbedding(openai, metaChunkText);
        if (metaEmb) {
          const metaVector = toSql(metaEmb);
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ContractEmbedding"
            ("id", "contractId", "chunkIndex", "chunkText", "embedding", "chunkType", "section", "tenantId", "contractType", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, 'metadata', 'Contract Metadata & Taxonomy', $5, $6, NOW(), NOW())
            ON CONFLICT ("contractId", "chunkIndex")
            DO UPDATE SET
              "chunkText" = EXCLUDED."chunkText",
              "embedding" = EXCLUDED."embedding",
              "tenantId"  = EXCLUDED."tenantId",
              "contractType" = EXCLUDED."contractType",
              "updatedAt" = NOW()
          `, contract.id, METADATA_CHUNK_INDEX, metaChunkText, metaVector,
             contract.tenantId || null, contract.contractType || null);
          contractEmbeddings++;
          console.log(`       📋 Metadata+taxonomy chunk`);
        }
      }

      // ── D. Remove legacy 9999 chunk ─────────────────────────────────
      await prisma.contractEmbedding.deleteMany({
        where: { contractId: contract.id, chunkIndex: 9999 },
      });

      // ── E. Update ContractMetadata tracking ─────────────────────────
      if (cm) {
        try {
          await prisma.contractMetadata.update({
            where: { contractId: contract.id },
            data: {
              ragSyncedAt: new Date(),
              embeddingCount: contractEmbeddings,
              lastEmbeddingAt: new Date(),
            },
          });
        } catch { /* contractMetadata may not exist */ }
      }

      totalEmbeddings += contractEmbeddings;
      totalSuccess++;
      console.log(`       ✅ ${contractEmbeddings} total embeddings\n`);

      // Rate limit: ~3 requests per second to stay under OpenAI limits
      await sleep(300);

    } catch (err: any) {
      totalFailed++;
      console.log(`       ❌ Failed: ${err.message}\n`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Processed:  ${totalSuccess + totalFailed}`);
  console.log(`  Succeeded:  ${totalSuccess}`);
  console.log(`  Failed:     ${totalFailed}`);
  console.log(`  Embeddings: ${totalEmbeddings}`);

  const dbCount = await prisma.contractEmbedding.count();
  console.log(`  Total in DB: ${dbCount}`);
  console.log('');

  await prisma.$disconnect();
}

// ── Helper: Generate a single embedding ─────────────────────────────────────
async function generateEmbedding(openai: any, text: string): Promise<number[] | null> {
  try {
    const createParams: Record<string, unknown> = {
      model: EMBED_MODEL,
      input: text.slice(0, 8000),
    };
    if (EMBED_DIMS > 0 && EMBED_MODEL.includes('text-embedding-3')) {
      createParams.dimensions = EMBED_DIMS;
    }
    const resp = await openai.embeddings.create(createParams as any);
    return resp.data[0]?.embedding || null;
  } catch (err: any) {
    if (err?.status === 429) {
      console.log('       ⏳ Rate limited, waiting 5s...');
      await sleep(5000);
      return generateEmbedding(openai, text);
    }
    console.log(`       ⚠️  Embedding error: ${err.message}`);
    return null;
  }
}

// ── Helper: Build text for a single artifact type ───────────────────────────
function buildSingleArtifactText(artifactType: string, data: any): string {
  if (!data) return '';
  const parts: string[] = [];

  switch (artifactType) {
    case 'overview': {
      if (data.summary) parts.push(`Summary: ${data.summary}`);
      if (data.contractType) parts.push(`Type: ${data.contractType}`);
      if (data.parties?.length) parts.push(`Parties: ${data.parties.map((p: any) => typeof p === 'string' ? p : p.name).join(', ')}`);
      if (data.effectiveDate) parts.push(`Effective: ${data.effectiveDate}`);
      if (data.expirationDate) parts.push(`Expires: ${data.expirationDate}`);
      if (data.totalValue) parts.push(`Value: ${data.totalValue}`);
      if (data.keyTerms?.length) parts.push(`Key Terms: ${data.keyTerms.join(', ')}`);
      break;
    }
    case 'clauses': {
      const clauses = Array.isArray(data) ? data : data.clauses || [];
      for (const c of clauses.slice(0, 30)) {
        const line = `[${c.category || 'General'}] ${c.text || c.content || c.title || ''}`.trim();
        if (c.riskLevel) parts.push(`${line} (Risk: ${c.riskLevel})`);
        else parts.push(line);
      }
      break;
    }
    case 'financial': {
      if (data.totalValue) parts.push(`Total Value: ${data.totalValue}`);
      if (data.currency) parts.push(`Currency: ${data.currency}`);
      if (data.paymentTerms) parts.push(`Payment Terms: ${data.paymentTerms}`);
      if (data.paymentSchedule) parts.push(`Schedule: ${JSON.stringify(data.paymentSchedule)}`);
      if (data.penalties?.length) parts.push(`Penalties: ${data.penalties.map((p: any) => p.description || p).join('; ')}`);
      if (data.rateCards?.length) parts.push(`Rate Cards: ${data.rateCards.length} entries`);
      break;
    }
    case 'risk': {
      const risks = Array.isArray(data) ? data : data.risks || data.items || [];
      for (const r of risks.slice(0, 20)) {
        parts.push(`[${r.severity || r.level || 'Medium'}] ${r.description || r.title || r.text || ''}`);
      }
      if (data.overallRiskScore) parts.push(`Overall Risk Score: ${data.overallRiskScore}`);
      break;
    }
    case 'compliance': {
      const items = Array.isArray(data) ? data : data.requirements || data.items || [];
      for (const c of items.slice(0, 20)) {
        parts.push(`[${c.status || 'Pending'}] ${c.requirement || c.description || c.text || ''}`);
      }
      break;
    }
    case 'obligations': {
      const items = Array.isArray(data) ? data : data.obligations || [];
      for (const o of items.slice(0, 20)) {
        parts.push(`[${o.party || 'Unknown'}] ${o.description || o.text || ''} ${o.deadline ? `(Due: ${o.deadline})` : ''}`);
      }
      break;
    }
    case 'renewal': {
      if (data.renewalType) parts.push(`Renewal Type: ${data.renewalType}`);
      if (data.autoRenewal != null) parts.push(`Auto-Renewal: ${data.autoRenewal}`);
      if (data.noticePeriod) parts.push(`Notice Period: ${data.noticePeriod}`);
      if (data.renewalTerms) parts.push(`Terms: ${data.renewalTerms}`);
      break;
    }
    case 'negotiation_points': {
      const items = Array.isArray(data) ? data : data.points || [];
      for (const n of items.slice(0, 15)) {
        parts.push(`[${n.priority || 'Medium'}] ${n.point || n.description || n.text || ''}`);
      }
      break;
    }
    case 'amendments': {
      const items = Array.isArray(data) ? data : data.amendments || [];
      for (const a of items.slice(0, 10)) {
        parts.push(`${a.date || 'N/A'}: ${a.description || a.text || ''}`);
      }
      break;
    }
    case 'contacts':
    case 'parties': {
      const items = Array.isArray(data) ? data : data.parties || data.contacts || [];
      for (const p of items.slice(0, 10)) {
        const name = p.name || p.organization || '';
        const role = p.role || p.type || '';
        parts.push(`${name}${role ? ` (${role})` : ''}`);
      }
      break;
    }
    case 'timeline': {
      const events = Array.isArray(data) ? data : data.events || data.milestones || [];
      for (const e of events.slice(0, 20)) {
        parts.push(`${e.date || 'TBD'}: ${e.description || e.event || e.text || ''}`);
      }
      break;
    }
    case 'executive_summary': {
      if (typeof data === 'string') parts.push(data);
      else if (data.summary) parts.push(data.summary);
      else if (data.text) parts.push(data.text);
      break;
    }
    case 'rates': {
      const rates = Array.isArray(data) ? data : data.rates || data.rateCards || [];
      for (const r of rates.slice(0, 30)) {
        parts.push(`${r.role || r.title || 'Role'}: ${r.rate || r.hourlyRate || r.amount || 'N/A'}${r.unit ? `/${r.unit}` : '/hr'}`);
      }
      break;
    }
    default: {
      // Generic fallback: serialize JSON
      const json = typeof data === 'string' ? data : JSON.stringify(data, null, 1);
      parts.push(json.slice(0, 3000));
    }
  }

  return parts.join('\n');
}

// ── Helper: Semantic chunking (from generate-embeddings.ts) ─────────────────
interface SemanticChunk {
  index: number;
  text: string;
  metadata: {
    section?: string;
    chunkType: 'heading' | 'paragraph' | 'list' | 'table' | 'clause' | 'metadata';
  };
}

function semanticChunk(text: string, maxChunkSize = 1500): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;

  const headingPattern = /^(?:#{1,6}\s+|(?:\d+\.)+\s+|[A-Z][A-Z\s]{2,}:?\s*$|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+)/gm;
  const listPattern = /^(?:\s*[-•*]\s+|\s*\d+[.)]\s+)/gm;
  const tablePattern = /\|.*\|/g;

  const sections = text.split(/\n(?=(?:#{1,3}\s+|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+))/i);

  for (const section of sections) {
    if (!section.trim()) continue;

    const headingMatch = section.match(headingPattern);
    const heading = headingMatch ? headingMatch[0].trim() : undefined;

    let chunkType: SemanticChunk['metadata']['chunkType'] = 'paragraph';
    if (heading) chunkType = 'heading';
    else if (listPattern.test(section)) chunkType = 'list';
    else if (tablePattern.test(section)) chunkType = 'table';
    else if (/clause|term|condition|obligation/i.test(section)) chunkType = 'clause';

    if (section.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: section.trim(),
        metadata: { section: heading, chunkType },
      });
      continue;
    }

    const paragraphs = section.split(/\n\n+/);
    let currentChunk = '';

    for (const para of paragraphs) {
      if (!para.trim()) continue;
      if (currentChunk.length + para.length > maxChunkSize && currentChunk.length >= 200) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          metadata: { section: heading, chunkType },
        });
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim().length >= 200) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        metadata: { section: heading, chunkType },
      });
    }
  }

  return chunks;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
