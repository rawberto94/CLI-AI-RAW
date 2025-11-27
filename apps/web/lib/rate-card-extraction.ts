/**
 * Rate Card Extraction from Contracts
 * Extracts rate cards using AI and saves them to the database
 */

import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] || '' });

/** Additional rate information from extraction */
export interface RateAdditionalInfo {
  originalRate?: number;
  originalPeriod?: string;
  minimumHours?: number;
  volumeDiscount?: string;
  [key: string]: string | number | boolean | undefined;
}

interface ExtractedRate {
  role: string;
  seniority: 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER';
  dailyRate: number;
  currency: string;
  location?: string;
  lineOfService?: string;
  skills?: string[];
  additionalInfo?: RateAdditionalInfo;
  confidence: number;
}

interface RateCardExtractionResult {
  rates: ExtractedRate[];
  supplierName?: string;
  effectiveDate?: string;
  expiryDate?: string;
  overallConfidence: number;
}

/**
 * Extract rate cards from contract text using AI
 */
export async function extractRateCardsFromContract(
  contractText: string,
  contractId: string
): Promise<RateCardExtractionResult> {
  try {
    const prompt = `You are an expert at extracting rate card information from contracts and statements of work.

TASK: Analyze the contract text and extract ALL rate information with high precision.

EXTRACT THE FOLLOWING:
1. Role/Position Names (as written in contract)
2. Seniority Levels (Junior, Mid-Level, Senior, Principal, Partner, Director, Manager)
3. Rates (hourly, daily, monthly, or annual)
4. Currency
5. Location/Country/Region
6. Line of Service (Technology, Consulting, Advisory, Finance, Legal, etc.)
7. Required Skills/Certifications
8. Minimum commitment (hours/days)
9. Volume discounts or tiered pricing
10. Contract dates (effective and expiry)

CONTRACT TEXT:
${contractText}

RATE CONVERSION RULES:
- Hourly → Daily: multiply by 8
- Monthly → Daily: divide by 22
- Annual → Daily: divide by 260
- Always preserve original rate and period in additionalInfo

SENIORITY MAPPING:
- Junior/Jr/Entry/Associate → JUNIOR
- Mid/Intermediate/Consultant → MID
- Senior/Sr/Lead → SENIOR
- Principal/Staff/Expert → PRINCIPAL
- Partner/Director/VP → PARTNER

CONFIDENCE SCORING:
- 0.9-1.0: Explicit rate table with clear role and rate
- 0.7-0.9: Rate mentioned in text with clear context
- 0.5-0.7: Rate inferred from context or ranges
- <0.5: Uncertain or estimated

RETURN JSON:
{
  "rates": [
    {
      "role": "Senior Software Engineer",
      "seniority": "SENIOR",
      "dailyRate": 1200,
      "currency": "USD",
      "location": "United States",
      "lineOfService": "Technology Consulting",
      "skills": ["Java", "Spring Boot", "AWS"],
      "additionalInfo": {
        "originalRate": 150,
        "originalPeriod": "hourly",
        "minimumHours": 40,
        "volumeDiscount": "10% for >500 hours"
      },
      "confidence": 0.95
    }
  ],
  "supplierName": "Acme Consulting LLC",
  "effectiveDate": "2025-01-01",
  "expiryDate": "2025-12-31",
  "overallConfidence": 0.92
}

IMPORTANT:
- Extract EVERY rate mentioned, even if in different formats
- Look for rate tables, appendices, schedules, and inline mentions
- If supplier name not found, use "Unknown Supplier"
- If dates not found, leave as null
- Return empty rates array if no rates found`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a rate card extraction expert. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content returned from AI');
    }

    const result: RateCardExtractionResult = JSON.parse(content);
    
    console.log(`✅ Extracted ${result.rates.length} rate cards from contract ${contractId}`);
    
    return result;
  } catch (error) {
    console.error('Error extracting rate cards:', error);
    throw error;
  }
}

/**
 * Standardize role name using AI
 */
export async function standardizeRoleName(roleOriginal: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a role standardization expert. Convert job titles to standardized formats. Return ONLY the standardized role name, nothing else.',
        },
        {
          role: 'user',
          content: `Standardize this role: "${roleOriginal}"

Examples:
- "Sr. Java Dev" → "Software Engineer"
- "Lead Data Scientist" → "Data Scientist"
- "Junior Full Stack Developer" → "Software Engineer"
- "Principal Architect" → "Solution Architect"

Return only the standardized role name.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 50,
    });

    const standardized = response.choices[0].message.content?.trim() || roleOriginal;
    console.log(`📝 Standardized "${roleOriginal}" → "${standardized}"`);
    
    return standardized;
  } catch (error) {
    console.error('Error standardizing role:', error);
    return roleOriginal; // Fallback to original
  }
}

/**
 * Convert currency to USD and CHF
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string
): Promise<{ usd: number; chf: number }> {
  // Simple conversion rates (in production, use a real-time FX API)
  const rates: Record<string, { usd: number; chf: number }> = {
    USD: { usd: 1.0, chf: 0.88 },
    EUR: { usd: 1.08, chf: 0.95 },
    GBP: { usd: 1.27, chf: 1.12 },
    CHF: { usd: 1.14, chf: 1.0 },
    CAD: { usd: 0.72, chf: 0.63 },
    AUD: { usd: 0.65, chf: 0.57 },
    INR: { usd: 0.012, chf: 0.011 },
  };

  const rate = rates[fromCurrency.toUpperCase()] || rates['USD'];
  
  return {
    usd: amount * rate.usd,
    chf: amount * rate.chf,
  };
}

/**
 * Get or create supplier
 */
export async function getOrCreateSupplier(params: {
  name: string;
  tier: 'BIG_4' | 'TIER_2' | 'BOUTIQUE' | 'OFFSHORE';
  country: string;
  region: string;
  tenantId: string;
}) {
  const existing = await prisma.rateCardSupplier.findUnique({
    where: {
      tenantId_name: {
        tenantId: params.tenantId,
        name: params.name,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return await prisma.rateCardSupplier.create({
    data: {
      tenantId: params.tenantId,
      name: params.name,
      legalName: params.name,
      tier: params.tier,
      country: params.country,
      region: params.region,
    },
  });
}

/**
 * Save extracted rate cards to database
 */
export async function saveExtractedRateCards(
  extractionResult: RateCardExtractionResult,
  contractId: string,
  tenantId: string
): Promise<string[]> {
  const savedIds: string[] = [];

  for (const rate of extractionResult.rates) {
    try {
      // Standardize role name
      const roleStandardized = await standardizeRoleName(rate.role);

      // Convert currency
      const converted = await convertCurrency(rate.dailyRate, rate.currency);

      // Get or create supplier
      const supplier = await getOrCreateSupplier({
        name: extractionResult.supplierName || 'Unknown Supplier',
        tier: 'TIER_2', // Default, can be enhanced
        country: rate.location || 'United States',
        region: 'Americas', // Can be enhanced with geo mapping
        tenantId,
      });

      // Determine role category from line of service
      const roleCategory = rate.lineOfService || 'Technology';

      // Create rate card entry
      const rateCard = await prisma.rateCardEntry.create({
        data: {
          tenantId,
          source: 'PDF_EXTRACTION',
          contractId,
          enteredBy: 'system',

          // Supplier
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierTier: supplier.tier,
          supplierCountry: supplier.country,
          supplierRegion: supplier.region,

          // Role
          roleOriginal: rate.role,
          roleStandardized,
          roleCategory,
          seniority: rate.seniority,
          lineOfService: rate.lineOfService || 'Technology Consulting',
          subCategory: null,

          // Rate
          dailyRate: rate.dailyRate,
          currency: rate.currency,
          dailyRateUSD: converted.usd,
          dailyRateCHF: converted.chf,

          // Geography
          country: rate.location || 'United States',
          region: 'Americas',
          city: null,
          remoteAllowed: false,

          // Contract context
          contractType: 'SOW',
          effectiveDate: extractionResult.effectiveDate 
            ? new Date(extractionResult.effectiveDate)
            : new Date(),
          expiryDate: extractionResult.expiryDate
            ? new Date(extractionResult.expiryDate)
            : null,

          // Quality
          confidence: rate.confidence,
          dataQuality: rate.confidence > 0.8 ? 'HIGH' : rate.confidence > 0.5 ? 'MEDIUM' : 'LOW',

          // Additional
          skills: rate.skills || [],
          additionalInfo: rate.additionalInfo,
        },
      });

      savedIds.push(rateCard.id);
      console.log(`✅ Saved rate card: ${rateCard.roleStandardized} - $${rateCard.dailyRate} ${rateCard.currency}/day`);
    } catch (error) {
      console.error(`❌ Error saving rate card for ${rate.role}:`, error);
    }
  }

  return savedIds;
}

/**
 * Main function to extract and save rate cards from contract
 */
export async function processContractForRateCards(
  contractId: string,
  tenantId: string
): Promise<{ success: boolean; rateCardIds: string[]; count: number }> {
  try {
    // Get contract with text
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        rawText: true,
        supplierName: true,
        fileName: true,
      },
    });

    if (!contract || !contract.rawText) {
      throw new Error('Contract not found or has no text');
    }

    console.log(`🔍 Extracting rate cards from contract: ${contract.fileName}`);

    // Extract rate cards using AI
    const extractionResult = await extractRateCardsFromContract(
      contract.rawText,
      contractId
    );

    if (extractionResult.rates.length === 0) {
      console.log(`ℹ️ No rate cards found in contract ${contractId}`);
      return { success: true, rateCardIds: [], count: 0 };
    }

    // Save to database
    const rateCardIds = await saveExtractedRateCards(
      extractionResult,
      contractId,
      tenantId
    );

    console.log(`✅ Successfully processed ${rateCardIds.length} rate cards from contract ${contractId}`);

    return {
      success: true,
      rateCardIds,
      count: rateCardIds.length,
    };
  } catch (error) {
    console.error(`❌ Error processing contract ${contractId} for rate cards:`, error);
    return {
      success: false,
      rateCardIds: [],
      count: 0,
    };
  }
}
