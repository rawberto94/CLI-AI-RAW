/**
 * Real LLM-Powered Artifact Generation Service
 * Phase 3: Enhanced with advanced prompt engineering
 * - Chain-of-Thought reasoning
 * - Structured extraction methodology
 * - Self-verification steps
 * - Comprehensive validation
 */

import { PrismaClient, ArtifactType } from "@prisma/client";
import { readFile } from "fs/promises";
import { 
  getEnhancedPrompt, 
  validateExtractedData,
  type EnhancedPromptConfig 
} from './enhanced-prompts';

// Dynamic import for OpenAI to avoid build issues
let OpenAI: any = null;

async function getOpenAI() {
  if (!OpenAI) {
    try {
      const module = await import("openai");
      OpenAI = module.default;
    } catch (error) {
      console.error("Failed to import OpenAI:", error);
      throw new Error("OpenAI SDK not available. Run: pnpm add openai");
    }
  }
  return OpenAI;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Models that support JSON mode
const JSON_MODE_SUPPORTED_MODELS = [
  "gpt-4o",
  "gpt-4o-mini", 
  "gpt-4o-2024-08-06",
  "gpt-4-turbo",
  "gpt-4-turbo-preview",
  "gpt-3.5-turbo-1106",
  "gpt-3.5-turbo-0125"
];

const supportsJsonMode = () => {
  return JSON_MODE_SUPPORTED_MODELS.some(model => MODEL.includes(model));
};

interface ArtifactGenerationResult {
  type: ArtifactType;
  data: any;
  confidence: number;
  processingTime: number;
}

/**
 * Extract text from PDF file
 */
async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  try {
    // For PDFs
    if (mimeType === "application/pdf") {
      try {
        // Read the file first
        const dataBuffer = await readFile(filePath);
        
        // Use dynamic require to avoid pdf-parse loading test files
        const pdfParse = eval('require')("pdf-parse");
        const pdfData = await pdfParse(dataBuffer);
        
        if (!pdfData || !pdfData.text) {
          throw new Error("PDF parsing returned no text");
        }
        
        return pdfData.text;
      } catch (pdfError: any) {
        console.error("PDF parsing error:", pdfError.message);
        throw new Error(`Failed to parse PDF: ${pdfError.message}`);
      }
    }

    // For DOCX
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    // For plain text
    if (mimeType === "text/plain") {
      return await readFile(filePath, "utf-8");
    }

    // Fallback
    return await readFile(filePath, "utf-8").catch(() => "");
  } catch (error) {
    console.error("Text extraction failed:", error);
    return "";
  }
}

/**
 * Generate OVERVIEW artifact using enhanced prompts
 */
async function generateOverviewArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();
  const promptConfig = getEnhancedPrompt('OVERVIEW');
  
  if (!promptConfig) {
    throw new Error('OVERVIEW prompt configuration not found');
  }

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: promptConfig.systemPrompt,
      },
      {
        role: "user",
        content: promptConfig.userPrompt(text),
      },
    ],
    ...(supportsJsonMode() ? { response_format: { type: "json_object" } } : {}),
    temperature: promptConfig.temperature,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  
  // Validate extracted data
  const validation = validateExtractedData('OVERVIEW', data);
  
  const processingTime = Date.now() - startTime;

  return {
    type: "OVERVIEW",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    },
    confidence: validation.isValid ? (data.confidenceScore || 0.92) : 0.75,
    processingTime,
  };
}

/**
 * Generate CLAUSES artifact using enhanced prompts
 */
async function generateClausesArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();
  const promptConfig = getEnhancedPrompt('CLAUSES');
  
  if (!promptConfig) {
    throw new Error('CLAUSES prompt configuration not found');
  }

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: promptConfig.systemPrompt,
      },
      {
        role: "user",
        content: promptConfig.userPrompt(text),
      },
    ],
    ...(supportsJsonMode() ? { response_format: { type: "json_object" } } : {}),
    temperature: promptConfig.temperature,
  });

  const data = JSON.parse(
    response.choices[0].message.content || '{"clauses":[]}'
  );
  
  // Validate extracted data
  const validation = validateExtractedData('CLAUSES', data);
  
  const processingTime = Date.now() - startTime;

  return {
    type: "CLAUSES",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    },
    confidence: validation.isValid ? 0.88 : 0.70,
    processingTime,
  };
}

/**
 * Generate FINANCIAL artifact using enhanced prompts
 */
async function generateFinancialArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();
  const promptConfig = getEnhancedPrompt('FINANCIAL');
  
  if (!promptConfig) {
    throw new Error('FINANCIAL prompt configuration not found');
  }

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: promptConfig.systemPrompt,
      },
      {
        role: "user",
        content: promptConfig.userPrompt(text),
      },
    ],
    ...(supportsJsonMode() ? { response_format: { type: "json_object" } } : {}),
    temperature: promptConfig.temperature,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  
  // Validate extracted data
  const validation = validateExtractedData('FINANCIAL', data);
  
  const processingTime = Date.now() - startTime;

  return {
    type: "FINANCIAL",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    },
    confidence: validation.isValid ? 0.85 : 0.65,
    processingTime,
  };
}

/**
 * Generate RISK artifact using enhanced prompts
 */
async function generateRiskArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();
  const promptConfig = getEnhancedPrompt('RISK');
  
  if (!promptConfig) {
    throw new Error('RISK prompt configuration not found');
  }

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: promptConfig.systemPrompt,
      },
      {
        role: "user",
        content: promptConfig.userPrompt(text),
      },
    ],
    ...(supportsJsonMode() ? { response_format: { type: "json_object" } } : {}),
    temperature: promptConfig.temperature,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  
  // Validate extracted data
  const validation = validateExtractedData('RISK', data);
  
  const processingTime = Date.now() - startTime;

  return {
    type: "RISK",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    },
    confidence: validation.isValid ? 0.87 : 0.70,
    processingTime,
  };
}

/**
 * Generate COMPLIANCE artifact using enhanced prompts
 */
async function generateComplianceArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();
  const promptConfig = getEnhancedPrompt('COMPLIANCE');
  
  if (!promptConfig) {
    throw new Error('COMPLIANCE prompt configuration not found');
  }

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: promptConfig.systemPrompt,
      },
      {
        role: "user",
        content: promptConfig.userPrompt(text),
      },
    ],
    ...(supportsJsonMode() ? { response_format: { type: "json_object" } } : {}),
    temperature: promptConfig.temperature,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  
  // Validate extracted data
  const validation = validateExtractedData('COMPLIANCE', data);
  
  const processingTime = Date.now() - startTime;

  return {
    type: "COMPLIANCE",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      }
    },
    confidence: validation.isValid ? 0.83 : 0.65,
    processingTime,
  };
}

/**
 * Main function to generate all artifacts for a contract
 */
export async function generateRealArtifacts(
  contractId: string,
  tenantId: string,
  filePath: string,
  mimeType: string,
  prisma: PrismaClient
): Promise<void> {
  console.log(
    `🤖 Starting REAL LLM artifact generation for contract ${contractId}`
  );

  try {
    // Step 1: Extract text from file
    console.log(`📄 Extracting text from ${filePath}...`);
    const extractedText = await extractTextFromFile(filePath, mimeType);

    if (!extractedText || extractedText.length < 100) {
      throw new Error("Text extraction failed or yielded insufficient content");
    }

    console.log(`✅ Extracted ${extractedText.length} characters`);

    // Step 1.5: Generate RAG embeddings for semantic search
    console.log(`🔍 Generating RAG embeddings for semantic search...`);
    try {
      // Dynamically import RAG client
      const { chunkText, embedChunks } = await import('@/packages/clients/rag');
      
      // Chunk the text
      const chunks = chunkText(extractedText);
      console.log(`  📦 Created ${chunks.length} text chunks`);
      
      // Generate and save embeddings
      await embedChunks(contractId, tenantId, chunks, {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.RAG_EMBED_MODEL || 'text-embedding-3-small'
      });
      
      console.log(`  ✅ Generated embeddings for ${chunks.length} chunks`);
    } catch (ragError) {
      console.error(`⚠️ RAG embedding generation failed (non-fatal):`, ragError);
      // Don't fail the whole process if RAG fails
    }

    // Step 2: Generate artifacts in parallel for speed
    console.log(`🧠 Generating artifacts with ${MODEL}...`);

    const [overview, clauses, financial, risk, compliance] = await Promise.all([
      generateOverviewArtifact(extractedText),
      generateClausesArtifact(extractedText),
      generateFinancialArtifact(extractedText),
      generateRiskArtifact(extractedText),
      generateComplianceArtifact(extractedText),
    ]);

    // Step 3: Save all artifacts to database
    console.log(`💾 Saving artifacts to database...`);

    const artifacts = [overview, clauses, financial, risk, compliance];
    let totalTokens = 0;

    for (const artifact of artifacts) {
      await prisma.artifact.upsert({
        where: {
          contractId_type: {
            contractId,
            type: artifact.type,
          },
        },
        create: {
          contractId,
          tenantId,
          type: artifact.type,
          data: artifact.data,
          confidence: artifact.confidence,
          processingTime: artifact.processingTime,
          schemaVersion: "v1",
        },
        update: {
          data: artifact.data,
          confidence: artifact.confidence,
          processingTime: artifact.processingTime,
        },
      });

      totalTokens += artifact.data.tokensUsed || 0;
      console.log(
        `  ✅ ${artifact.type}: ${artifact.processingTime}ms, confidence: ${artifact.confidence}`
      );
    }

    console.log(
      `🎉 All artifacts generated! Total tokens used: ${totalTokens}`
    );
    console.log(
      `💰 Estimated cost: $${((totalTokens * 0.00015) / 1000).toFixed(4)}`
    );

    // Step 4: Extract and save rate cards from financial artifact
    console.log(`💳 Extracting rate cards from financial artifact...`);
    try {
      // First, save the extracted text to the contract for rate card extraction
      await prisma.contract.update({
        where: { id: contractId },
        data: { rawText: extractedText },
      });

      const { processContractForRateCards } = await import('./rate-card-extraction');
      const rateCardResult = await processContractForRateCards(contractId, tenantId);
      
      if (rateCardResult.success && rateCardResult.count > 0) {
        console.log(`  ✅ Extracted ${rateCardResult.count} rate cards`);
        
        // Step 5: Trigger benchmarking for extracted rate cards
        console.log(`📊 Triggering benchmark calculation for rate cards...`);
        try {
          const { triggerRateCardBenchmarking } = await import('./rate-card-benchmarking-trigger');
          await triggerRateCardBenchmarking(contractId, tenantId);
          console.log(`  ✅ Benchmark calculation initiated`);
        } catch (benchmarkError) {
          console.error(`⚠️ Benchmark calculation failed (non-fatal):`, benchmarkError);
        }
      } else {
        console.log(`  ℹ️ No rate cards found in contract`);
      }
    } catch (rateCardError) {
      console.error(`⚠️ Rate card extraction failed (non-fatal):`, rateCardError);
      // Don't fail the whole process if rate card extraction fails
    }

    // Update contract status to COMPLETED
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        lastAnalyzedAt: new Date(),
      },
    });

    console.log(`✅ Contract ${contractId} marked as COMPLETED`);
  } catch (error) {
    console.error(`❌ Real artifact generation failed:`, error);
    
    // Mark contract as FAILED
    try {
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: "FAILED",
        },
      });
    } catch (updateError) {
      console.error("Failed to update contract status:", updateError);
    }
    
    throw error;
  }
}

/**
 * Generate a single artifact from raw text (used by regeneration and improvement flows)
 */
export async function generateRealArtifact(rawText: string, artifactType: string) {
  switch (artifactType) {
    case 'OVERVIEW': {
      const res = await generateOverviewArtifact(rawText);
      return res.data;
    }
    case 'CLAUSES': {
      const res = await generateClausesArtifact(rawText);
      return res.data;
    }
    case 'FINANCIAL': {
      const res = await generateFinancialArtifact(rawText);
      return res.data;
    }
    case 'RISK': {
      const res = await generateRiskArtifact(rawText);
      return res.data;
    }
    case 'COMPLIANCE': {
      const res = await generateComplianceArtifact(rawText);
      return res.data;
    }
    default:
      throw new Error(`Unsupported artifact type: ${artifactType}`);
  }
}
