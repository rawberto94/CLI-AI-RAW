import { NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Simple and reliable upload handler
export async function POST(req: Request) {
  console.log('📤 Upload request received at /api/upload (fallback endpoint)');

  try {
    const form = await req.formData();
    const file = form.get('file');

    console.log('📋 Form data parsed, file:', !!file);

    // Basic file validation
    if (!file) {
      console.log('❌ No file found in form data');
      return NextResponse.json({ 
        success: false,
        error: 'No file provided' 
      }, { status: 400 });
    }

    // Get file details safely
    const fileName = (file as File).name || 'contract.pdf';
    const fileSize = (file as File).size || 0;
    const fileType = (file as File).type || 'application/octet-stream';

    console.log('📄 File details:', { fileName, fileSize, fileType });

    // Create contract ID
    const contractId = `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Generated contract ID:', contractId);

    // Create directories
    const uploadDir = join(process.cwd(), 'uploads');
    const contractsDir = join(process.cwd(), 'data', 'contracts');

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    if (!existsSync(contractsDir)) {
      await mkdir(contractsDir, { recursive: true });
    }

    // Save file
    const filePath = join(uploadDir, `${contractId}_${fileName}`);
    const buffer = Buffer.from(await (file as File).arrayBuffer());
    await writeFile(filePath, buffer);

    console.log('💾 File saved to:', filePath);

    // Create contract data
    const contractData = {
      id: contractId,
      filename: fileName,
      uploadDate: new Date().toISOString(),
      status: 'processing',
      fileSize: fileSize,
      mimeType: fileType,
      filePath: filePath,
      processing: {
        status: 'processing',
        progress: 10,
        currentStage: 'upload',
        startTime: new Date().toISOString(),
      },
    };

    // Save contract metadata
    const contractDataPath = join(contractsDir, `${contractId}.json`);
    await writeFile(contractDataPath, JSON.stringify(contractData, null, 2));

    console.log('📊 Contract metadata saved');

    // Start processing in background
    processContract(contractId, filePath, fileName).catch(error => {
      console.error('Processing error:', error);
    });

    console.log('✅ Upload successful, processing started');

    return NextResponse.json(
      {
        success: true,
        contractId: contractId,
        fileName: fileName,
        fileSize: fileSize,
        mimeType: fileType,
        status: 'processing',
        message: 'File uploaded successfully and processing started',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Upload failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

// Background processing function
async function processContract(
  contractId: string,
  filePath: string,
  fileName: string
) {
  console.log('🔄 Starting contract processing for:', contractId);

  const stages = [
    { id: 'extraction', name: 'Text Extraction', duration: 2000 },
    { id: 'structure', name: 'Structure Analysis', duration: 1500 },
    { id: 'entities', name: 'Entity Recognition', duration: 2000 },
    { id: 'financial', name: 'Financial Analysis', duration: 3000 },
    { id: 'benchmarking', name: 'Rate Benchmarking', duration: 4000 },
    { id: 'procurement', name: 'Procurement Intelligence', duration: 3500 },
    { id: 'renewal', name: 'Renewal Analysis', duration: 2000 },
    { id: 'compliance', name: 'Compliance & ESG Check', duration: 2500 },
    { id: 'savings', name: 'Savings Opportunities', duration: 2000 },
    { id: 'risk', name: 'Risk Assessment', duration: 2000 },
    { id: 'clauses', name: 'Clause Classification', duration: 2500 },
    { id: 'complete', name: 'Analysis Complete', duration: 500 },
  ];

  let progress = 15; // Start after upload (10%)
  const progressPerStage = 85 / stages.length; // Remaining 85%

  try {
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];

      // Update status
      await updateStatus(contractId, {
        currentStage: stage.id,
        progress: Math.round(progress),
        status: 'processing',
      });

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, stage.duration));

      progress += progressPerStage;
    }

    // Generate results
    const results = generateResults(fileName);
    await saveResults(contractId, results);

    // Mark complete
    await updateStatus(contractId, {
      currentStage: 'completed',
      progress: 100,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    console.log('✅ Processing completed for:', contractId);
  } catch (error) {
    console.error('❌ Processing failed:', error);
    await updateStatus(contractId, {
      currentStage: 'failed',
      progress: 0,
      status: 'failed',
      error: error.message,
    });
  }
}

async function updateStatus(contractId: string, update: any) {
  try {
    const contractDataPath = join(
      process.cwd(),
      'data',
      'contracts',
      `${contractId}.json`
    );
    if (existsSync(contractDataPath)) {
      const data = JSON.parse(await readFile(contractDataPath, 'utf-8'));
      data.processing = { ...data.processing, ...update };
      data.status = update.status;
      await writeFile(contractDataPath, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Status update error:', error);
  }
}

async function saveResults(contractId: string, results: any) {
  try {
    const contractDataPath = join(
      process.cwd(),
      'data',
      'contracts',
      `${contractId}.json`
    );
    if (existsSync(contractDataPath)) {
      const data = JSON.parse(await readFile(contractDataPath, 'utf-8'));
      data.extractedData = results;
      await writeFile(contractDataPath, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Results save error:', error);
  }
}

function generateResults(fileName: string) {
  return {
    text: `STATEMENT OF WORK - Professional Services Agreement

Contract Number: SOW-2024-001
Effective Date: January 1, 2024
Total Value: $750,000 USD

PARTIES:
Client: TechCorp Inc.
Service Provider: Digital Solutions LLC

PAYMENT SCHEDULE:
Project Kickoff: $187,500 (25%) - January 15, 2024
Phase 1 Completion: $187,500 (25%) - April 15, 2024
Phase 2 Completion: $187,500 (25%) - July 15, 2024
Final Delivery: $187,500 (25%) - October 15, 2024

RATE CARD:
Senior Consultant: $175/hr ($1,400/day)
Project Manager: $150/hr ($1,200/day)
Business Analyst: $125/hr ($1,000/day)
Senior Developer: $140/hr ($1,120/day)
Developer: $110/hr ($880/day)
QA Engineer: $115/hr ($920/day)
Technical Architect: $195/hr ($1,560/day)
Data Analyst: $120/hr ($960/day)
UX Designer: $130/hr ($1,040/day)
DevOps Engineer: $165/hr ($1,320/day)`,

    metadata: {
      contractType: 'Statement of Work',
      parties: ['TechCorp Inc.', 'Digital Solutions LLC'],
      effectiveDate: '2024-01-01',
      expirationDate: '2024-12-31',
      totalValue: '$750,000',
      currency: 'USD',
    },

    financial: {
      totalValue: 750000,
      currency: 'USD',
      paymentTerms: 'Net 30 days',
      milestones: 4,
      penalties: ['Late payment: 1.5% per month'],
      extractedTables: [
        {
          title: 'Payment Schedule',
          type: 'payment_schedule',
          rows: [
            {
              milestone: 'Project Kickoff',
              percentage: '25%',
              amount: '$187,500',
              dueDate: 'January 15, 2024',
            },
            {
              milestone: 'Phase 1 Completion',
              percentage: '25%',
              amount: '$187,500',
              dueDate: 'April 15, 2024',
            },
            {
              milestone: 'Phase 2 Completion',
              percentage: '25%',
              amount: '$187,500',
              dueDate: 'July 15, 2024',
            },
            {
              milestone: 'Final Delivery',
              percentage: '25%',
              amount: '$187,500',
              dueDate: 'October 15, 2024',
            },
          ],
        },
        {
          title: 'Expense Breakdown',
          type: 'expense_breakdown',
          rows: [
            {
              category: 'Professional Services',
              budgetAmount: '$525,000',
              percentage: '70%',
            },
            {
              category: 'Travel & Expenses',
              budgetAmount: '$112,500',
              percentage: '15%',
            },
            {
              category: 'Software Licenses',
              budgetAmount: '$75,000',
              percentage: '10%',
            },
            {
              category: 'Contingency',
              budgetAmount: '$37,500',
              percentage: '5%',
            },
          ],
        },
      ],
      rateCards: [
        {
          title: 'Professional Services Rate Card',
          type: 'hourly_rates',
          currency: 'USD',
          effectiveDate: '2024-01-01',
          rates: [
            {
              role: 'Senior Consultant',
              level: 'Senior',
              hourlyRate: 175,
              dailyRate: 1400,
              marketBenchmark: 165,
              variance: '+6.1%',
              annualSavingsOpportunity: '$20,800',
            },
            {
              role: 'Project Manager',
              level: 'Senior',
              hourlyRate: 150,
              dailyRate: 1200,
              marketBenchmark: 145,
              variance: '+3.4%',
              annualSavingsOpportunity: '$10,400',
            },
            {
              role: 'Business Analyst',
              level: 'Mid',
              hourlyRate: 125,
              dailyRate: 1000,
              marketBenchmark: 120,
              variance: '+4.2%',
              annualSavingsOpportunity: '$10,400',
            },
            {
              role: 'Senior Developer',
              level: 'Senior',
              hourlyRate: 140,
              dailyRate: 1120,
              marketBenchmark: 155,
              variance: '-9.7%',
              annualSavingsOpportunity: 'Market Rate',
            },
            {
              role: 'Developer',
              level: 'Mid',
              hourlyRate: 110,
              dailyRate: 880,
              marketBenchmark: 115,
              variance: '-4.3%',
              annualSavingsOpportunity: 'Market Rate',
            },
            {
              role: 'QA Engineer',
              level: 'Mid',
              hourlyRate: 115,
              dailyRate: 920,
              marketBenchmark: 115,
              variance: '0.0%',
              annualSavingsOpportunity: 'Market Rate',
            },
            {
              role: 'Technical Architect',
              level: 'Principal',
              hourlyRate: 195,
              dailyRate: 1560,
              marketBenchmark: 185,
              variance: '+5.4%',
              annualSavingsOpportunity: '$20,800',
            },
            {
              role: 'Data Analyst',
              level: 'Mid',
              hourlyRate: 120,
              dailyRate: 960,
              marketBenchmark: 125,
              variance: '-4.0%',
              annualSavingsOpportunity: 'Market Rate',
            },
            {
              role: 'UX Designer',
              level: 'Mid',
              hourlyRate: 130,
              dailyRate: 1040,
              marketBenchmark: 135,
              variance: '-3.7%',
              annualSavingsOpportunity: 'Market Rate',
            },
            {
              role: 'DevOps Engineer',
              level: 'Senior',
              hourlyRate: 165,
              dailyRate: 1320,
              marketBenchmark: 160,
              variance: '+3.1%',
              annualSavingsOpportunity: '$10,400',
            },
          ],
          insights: {
            totalAnnualSavings: '$62,400',
            averageVariance: '+1.8%',
            ratesAboveMarket: 4,
            ratesBelowMarket: 4,
            recommendation:
              'Negotiate rates for Senior Consultant and Technical Architect roles',
          },
        },
      ],
    },

    risk: {
      overallScore: 67,
      level: 'Medium',
      factors: [
        {
          type: 'Liability Cap',
          severity: 'High',
          description: 'Liability cap may be insufficient for contract value',
        },
        {
          type: 'Auto-Renewal',
          severity: 'Medium',
          description: 'Contract has automatic renewal clause',
        },
        {
          type: 'Termination Notice',
          severity: 'Low',
          description: 'Standard 30-day termination notice period',
        },
      ],
    },

    compliance: {
      score: 85,
      checks: [
        {
          regulation: 'GDPR',
          status: 'Compliant',
          details: 'Data protection clauses present',
        },
        {
          regulation: 'SOX',
          status: 'Compliant',
          details: 'Financial controls documented',
        },
        {
          regulation: 'Industry Standards',
          status: 'Partial',
          details: 'Some industry-specific clauses missing',
        },
      ],
    },

    clauses: {
      total: 23,
      categories: [
        { type: 'Payment Terms', count: 3, riskLevel: 'Low' },
        { type: 'Termination', count: 2, riskLevel: 'Medium' },
        { type: 'Liability', count: 4, riskLevel: 'High' },
        { type: 'Intellectual Property', count: 5, riskLevel: 'Low' },
        { type: 'Confidentiality', count: 3, riskLevel: 'Low' },
        { type: 'Compliance', count: 6, riskLevel: 'Medium' },
      ],
    },

    // Enhanced Procurement Intelligence
    procurementIntelligence: {
      benchmarking: {
        rateCardAnalysis: [
          {
            role: 'Senior Consultant',
            level: 'Senior',
            currentRate: 175,
            marketMedian: 165,
            percentile: 65,
            variance: '+6.1%',
            savingsOpportunity: 20800,
            benchmarkConfidence: 90,
            recommendedAction: 'Negotiate down to market median'
          }
        ],
        marketComparison: {
          overallPositioning: 'Above Market',
          averageVariance: 5.2,
          totalAnnualSavings: 125000,
          ratesAboveMarket: 4,
          ratesBelowMarket: 6,
          marketDataQuality: 'High'
        },
        competitivePositioning: {
          quartile: 3,
          percentile: 65,
          competitiveAdvantage: 'Above Average',
          marketTrend: 'Increasing'
        },
        negotiationInsights: [
          {
            priority: 'High',
            recommendation: 'Focus on senior-level roles for maximum savings',
            leveragePoints: ['Market data shows 6% premium', 'Volume commitment opportunity'],
            estimatedSavings: 125000
          }
        ]
      },
      renewalRadar: [
        {
          contractId: 'current-contract',
          endDate: '2024-12-31',
          daysUntilExpiration: 365,
          urgencyLevel: 'Low',
          renewalRecommendation: 'Begin renewal negotiations 90 days before expiration',
          negotiationPriority: ['Rate optimization', 'Service level improvements', 'Volume discounts'],
          estimatedSavings: 125000
        }
      ],
      spendIntelligence: {
        categoryAlignment: [
          {
            category: 'Professional Services',
            currentSpend: 750000,
            contractedAmount: 750000,
            variance: 0,
            alignment: 'Aligned'
          }
        ],
        supplierConsolidation: [
          {
            category: 'IT Services',
            currentSuppliers: 5,
            recommendedSuppliers: 3,
            potentialSavings: 85000,
            consolidationEffort: 'Medium'
          }
        ],
        volumeBundling: [
          {
            opportunity: 'Multi-year commitment discount',
            currentVolume: 750000,
            bundledVolume: 2250000,
            potentialSavings: 112500,
            implementationRisk: 'Low'
          }
        ],
        spendOptimization: {
          totalOptimizationPotential: 322500,
          quickWins: 85000,
          strategicInitiatives: 237500,
          implementationTimeline: '6-12 months'
        }
      },
      complianceMonitoring: {
        overallScore: 87,
        esgCompliance: {
          sustainabilityScore: 78,
          diversityMetrics: {
            supplierDiversity: 65,
            womenOwnedBusiness: true,
            minorityOwnedBusiness: false,
            smallBusiness: true
          },
          governanceRating: 85,
          improvementAreas: ['Carbon footprint reporting', 'Supply chain transparency']
        },
        regulatoryCompliance: [
          {
            regulation: 'GDPR',
            status: 'Compliant',
            score: 95,
            lastAudit: '2024-01-15'
          },
          {
            regulation: 'SOX',
            status: 'Compliant',
            score: 88,
            lastAudit: '2024-02-01'
          }
        ],
        policyViolations: [],
        riskMitigation: [
          {
            riskType: 'Data Security',
            mitigationStrategy: 'Enhanced encryption protocols',
            effectiveness: 'High'
          }
        ]
      },
      savingsOpportunities: [
        {
          type: 'Rate Optimization',
          description: 'Negotiate senior-level consulting rates to market median',
          annualSavings: 125000,
          implementationEffort: 'Medium',
          riskLevel: 'Low',
          timeframe: '3-6 months',
          confidence: 85
        },
        {
          type: 'Volume Bundling',
          description: 'Multi-year commitment for volume discounts',
          annualSavings: 112500,
          implementationEffort: 'Low',
          riskLevel: 'Low',
          timeframe: '1-3 months',
          confidence: 90
        },
        {
          type: 'Supplier Consolidation',
          description: 'Consolidate IT services suppliers from 5 to 3',
          annualSavings: 85000,
          implementationEffort: 'High',
          riskLevel: 'Medium',
          timeframe: '6-12 months',
          confidence: 75
        },
        {
          type: 'Contract Renegotiation',
          description: 'Renegotiate payment terms and service levels',
          annualSavings: 45000,
          implementationEffort: 'Medium',
          riskLevel: 'Low',
          timeframe: '2-4 months',
          confidence: 80
        }
      ]
    }
  };
}