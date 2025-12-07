/**
 * AI Contract Group Comparison API
 * 
 * POST /api/ai/compare-contracts - Compare two groups of contracts with AI analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerTenantId } from '@/lib/tenant-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ContractSummary {
  title: string;
  supplier: string;
  value: number;
  effectiveDate: string | null;
  expirationDate: string | null;
  category: string | null;
  paymentTerms: string | null;
}

interface GroupData {
  name: string;
  contracts: ContractSummary[];
  totalValue: number;
  avgValue: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { group1, group2 } = body as { group1: GroupData; group2: GroupData };

    if (!group1 || !group2) {
      return NextResponse.json(
        { error: 'Both group1 and group2 are required' },
        { status: 400 }
      );
    }

    if (group1.contracts.length === 0 || group2.contracts.length === 0) {
      return NextResponse.json(
        { error: 'Both groups must have at least one contract' },
        { status: 400 }
      );
    }

    // Check if OpenAI is available
    if (!process.env.OPENAI_API_KEY) {
      // Return fallback analysis
      return NextResponse.json({
        success: true,
        data: {
          analysis: generateFallbackAnalysis(group1, group2),
          source: 'fallback',
        },
      });
    }

    try {
      const prompt = buildComparisonPrompt(group1, group2);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a contract analysis expert specializing in procurement and vendor management. 
Analyze contract groups and provide actionable insights for procurement professionals.
Focus on:
- Value for money comparison
- Risk assessment
- Contract terms optimization
- Negotiation leverage opportunities
- Supplier relationship management

Format your response in clear markdown with headers and bullet points.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const analysis = completion.choices[0]?.message?.content || 'Unable to generate analysis';

      return NextResponse.json({
        success: true,
        data: {
          analysis,
          source: 'openai',
          model: 'gpt-4o-mini',
          processingTime: Date.now() - startTime,
        },
      });
    } catch (openaiError: any) {
      console.error('OpenAI API error:', openaiError);
      
      // Return fallback analysis on OpenAI error
      return NextResponse.json({
        success: true,
        data: {
          analysis: generateFallbackAnalysis(group1, group2),
          source: 'fallback',
          error: openaiError.message,
        },
      });
    }
  } catch (error) {
    console.error('Compare contracts error:', error);
    return NextResponse.json(
      { error: 'Failed to compare contracts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildComparisonPrompt(group1: GroupData, group2: GroupData): string {
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  
  let prompt = `## Contract Group Comparison Analysis Request

### Group A: ${group1.name}
- **Number of Contracts:** ${group1.contracts.length}
- **Total Value:** ${formatCurrency(group1.totalValue)}
- **Average Contract Value:** ${formatCurrency(group1.avgValue)}

**Contracts in Group A:**
`;

  group1.contracts.forEach((c, i) => {
    prompt += `${i + 1}. ${c.title || 'Untitled'} - ${c.supplier || 'Unknown Supplier'} - ${formatCurrency(c.value || 0)}`;
    if (c.effectiveDate) prompt += ` (${new Date(c.effectiveDate).getFullYear()})`;
    prompt += '\n';
  });

  prompt += `
### Group B: ${group2.name}
- **Number of Contracts:** ${group2.contracts.length}
- **Total Value:** ${formatCurrency(group2.totalValue)}
- **Average Contract Value:** ${formatCurrency(group2.avgValue)}

**Contracts in Group B:**
`;

  group2.contracts.forEach((c, i) => {
    prompt += `${i + 1}. ${c.title || 'Untitled'} - ${c.supplier || 'Unknown Supplier'} - ${formatCurrency(c.value || 0)}`;
    if (c.effectiveDate) prompt += ` (${new Date(c.effectiveDate).getFullYear()})`;
    prompt += '\n';
  });

  prompt += `
---

Please provide a comprehensive comparison analysis including:

1. **Executive Summary** - Key findings at a glance
2. **Value Analysis** - Compare total spend, average values, and value for money
3. **Supplier Assessment** - Compare supplier diversity, concentration risk
4. **Risk Factors** - Identify potential risks in each group (expiration, renewal terms)
5. **Optimization Opportunities** - Specific recommendations for cost savings or improved terms
6. **Strategic Recommendations** - Actions the procurement team should consider

Be specific and actionable in your recommendations.`;

  return prompt;
}

function generateFallbackAnalysis(group1: GroupData, group2: GroupData): string {
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  
  const valueDiff = group1.totalValue - group2.totalValue;
  const percentDiff = group2.totalValue > 0 ? Math.round((Math.abs(valueDiff) / group2.totalValue) * 100) : 0;
  
  let analysis = `## Contract Group Comparison Analysis\n\n`;
  
  analysis += `### Executive Summary\n`;
  analysis += `Comparing **${group1.name}** (${group1.contracts.length} contracts, ${formatCurrency(group1.totalValue)}) `;
  analysis += `with **${group2.name}** (${group2.contracts.length} contracts, ${formatCurrency(group2.totalValue)}).\n\n`;
  
  analysis += `### Value Analysis\n`;
  analysis += `- **${group1.name}** has a total value of ${formatCurrency(group1.totalValue)} with an average of ${formatCurrency(group1.avgValue)} per contract\n`;
  analysis += `- **${group2.name}** has a total value of ${formatCurrency(group2.totalValue)} with an average of ${formatCurrency(group2.avgValue)} per contract\n`;
  
  if (Math.abs(percentDiff) > 10) {
    analysis += `- There is a **${percentDiff}% difference** in total value between the groups\n`;
  }
  analysis += `\n`;
  
  analysis += `### Supplier Assessment\n`;
  const suppliers1 = [...new Set(group1.contracts.map(c => c.supplier).filter(Boolean))];
  const suppliers2 = [...new Set(group2.contracts.map(c => c.supplier).filter(Boolean))];
  analysis += `- ${group1.name} involves ${suppliers1.length} unique supplier(s): ${suppliers1.join(', ') || 'Unknown'}\n`;
  analysis += `- ${group2.name} involves ${suppliers2.length} unique supplier(s): ${suppliers2.join(', ') || 'Unknown'}\n\n`;
  
  analysis += `### Strategic Recommendations\n`;
  analysis += `1. Review contracts expiring within the next 90 days for renewal opportunities\n`;
  analysis += `2. Compare payment terms and conditions between suppliers to identify negotiation leverage\n`;
  analysis += `3. Consider consolidating similar contracts for better negotiating position\n`;
  
  if (group1.contracts.length > 3 || group2.contracts.length > 3) {
    analysis += `4. Evaluate volume discount opportunities given the number of contracts\n`;
  }
  
  analysis += `\n*Note: This is a basic analysis. For deeper AI-powered insights, configure the OpenAI API key.*`;
  
  return analysis;
}
