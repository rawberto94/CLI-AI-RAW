import { Page, Route } from '@playwright/test';

export interface MockUploadPipelineOptions {
  tenantId?: string;
  contractId?: string;
  artifactCount?: number;
}

interface MockArtifactRecord {
  id: string;
  type: string;
  status: 'COMPLETED';
  hasContent: boolean;
  contentLength: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_ARTIFACTS: Array<{ type: string; data: Record<string, unknown> }> = [
  {
    type: 'OVERVIEW',
    data: {
      summary: 'Executive summary of the master services agreement with payment terms and obligations.',
      parties: ['Acme Corp', 'TechSolutions Inc.'],
      totalValue: 215000,
      currency: 'USD',
      effectiveDate: '2024-01-01',
      expirationDate: '2024-12-31',
    },
  },
  {
    type: 'CLAUSES',
    data: {
      clauses: [
        { title: 'Scope of Work', importance: 'high', summary: 'Full-stack development and cloud services' },
        { title: 'Payment Terms', importance: 'high', summary: 'Monthly invoicing, Net-30, 1.5% late fee' },
      ],
    },
  },
  {
    type: 'FINANCIAL',
    data: {
      rateCards: [
        { role: 'Senior Engineer', rate: 150 },
        { role: 'DevOps Engineer', rate: 125 },
      ],
      milestones: [
        { name: 'Backend API Development', amount: 50000 },
        { name: 'Mobile App Delivery', amount: 60000 },
      ],
    },
  },
  {
    type: 'RISK',
    data: {
      risks: [
        { category: 'Delivery', level: 'Medium', mitigation: 'Weekly status reviews' },
        { category: 'Compliance', level: 'Low', mitigation: 'SOC2 controls verified' },
      ],
    },
  },
  {
    type: 'COMPLIANCE',
    data: {
      regulations: [
        { name: 'GDPR', status: 'compliant' },
        { name: 'ISO 27001', status: 'compliant' },
      ],
    },
  },
];

function buildArtifactRecords(contractId: string, createdAt: string, artifactCount: number): MockArtifactRecord[] {
  const source = DEFAULT_ARTIFACTS.slice(0, artifactCount);
  return source.map((artifact, index) => ({
    id: `${contractId}-artifact-${index + 1}`,
    type: artifact.type,
    status: 'COMPLETED',
    hasContent: true,
    contentLength: JSON.stringify(artifact.data).length,
    metadata: artifact.data,
    createdAt,
    updatedAt: createdAt,
  }));
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function setupMockUploadPipeline(page: Page, options: MockUploadPipelineOptions = {}) {
  const tenantId = options.tenantId ?? 'demo';
  const contractId = options.contractId ?? `mock-contract-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const artifactCount = options.artifactCount ?? DEFAULT_ARTIFACTS.length;
  const artifacts = buildArtifactRecords(contractId, createdAt, artifactCount);

  const statusTimeline = [
    { status: 'UPLOADED', progress: 25, currentStep: 'upload', artifactsGenerated: 0 },
    { status: 'PROCESSING', progress: 60, currentStep: 'ocr', artifactsGenerated: 0 },
    { status: 'PROCESSING', progress: 85, currentStep: 'artifacts', artifactsGenerated: Math.floor(artifactCount / 2) },
    { status: 'COMPLETED', progress: 100, currentStep: 'complete', artifactsGenerated: artifactCount },
  ];
  let statusIndex = -1;

  await page.route('**/api/contracts/upload', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }

    await fulfillJson(route, {
      success: true,
      contractId,
      fileName: 'mock-contract.pdf',
      fileSize: 6612,
      mimeType: 'application/pdf',
      status: 'PROCESSING',
      processingJobId: `job-${contractId}`,
      message: 'File uploaded successfully (mock)',
    }, 201);
  });

  await page.route(`**/api/contracts/${contractId}/status`, async (route) => {
    statusIndex = Math.min(statusIndex + 1, statusTimeline.length - 1);
    const state = statusTimeline[statusIndex];

    await fulfillJson(route, {
      contractId,
      fileName: 'mock-contract.pdf',
      fileSize: 6612,
      mimeType: 'application/pdf',
      totalArtifacts: artifactCount,
      artifactTypes: artifacts.map((a) => a.type.toLowerCase()),
      hasOverview: artifacts.some((a) => a.type === 'OVERVIEW'),
      hasFinancial: artifacts.some((a) => a.type === 'FINANCIAL'),
      hasRisk: artifacts.some((a) => a.type === 'RISK'),
      hasCompliance: artifacts.some((a) => a.type === 'COMPLIANCE'),
      hasClauses: artifacts.some((a) => a.type === 'CLAUSES'),
      createdAt,
      updatedAt: createdAt,
      error: null,
      ...state,
    });
  });

  await page.route(`**/api/contracts/${contractId}`, async (route) => {
    const extractedData = artifacts.reduce<Record<string, unknown>>((acc, record, index) => {
      acc[record.type.toLowerCase()] = DEFAULT_ARTIFACTS[index]?.data ?? {};
      return acc;
    }, {});

    await fulfillJson(route, {
      id: contractId,
      filename: 'mock-contract.pdf',
      uploadDate: createdAt,
      status: 'completed',
      tenantId,
      uploadedBy: 'integration-tests',
      fileSize: 6612,
      mimeType: 'application/pdf',
      artifactCount: artifactCount,
      artifacts: artifacts.map((artifact) => ({
        type: artifact.type,
        data: DEFAULT_ARTIFACTS.find((a) => a.type === artifact.type)?.data,
      })),
      extractedData,
      processing: {
        jobId: `job-${contractId}`,
        status: 'COMPLETED',
        currentStage: 'completed',
        progress: 100,
        startTime: createdAt,
        completedAt: createdAt,
      },
      summary: {
        totalClauses: DEFAULT_ARTIFACTS.find((a) => a.type === 'CLAUSES')?.data?.clauses?.length ?? 0,
        riskFactors: DEFAULT_ARTIFACTS.find((a) => a.type === 'RISK')?.data?.risks?.length ?? 0,
        complianceIssues: 0,
        financialTerms: DEFAULT_ARTIFACTS.find((a) => a.type === 'FINANCIAL')?.data?.rateCards?.length ?? 0,
        keyParties: DEFAULT_ARTIFACTS.find((a) => a.type === 'OVERVIEW')?.data?.parties?.length ?? 0,
      },
      insights: [],
    });
  });

  await page.route(`**/api/contracts/${contractId}/artifacts`, async (route) => {
    await fulfillJson(route, {
      success: true,
      data: artifacts,
      meta: { count: artifacts.length, contractId },
    });
  });

  await page.route('**/api/contracts?**', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue();
    }

    await fulfillJson(route, {
      success: true,
      data: {
        contracts: [
          {
            id: contractId,
            filename: 'mock-contract.pdf',
            originalName: 'mock-contract.pdf',
            status: 'COMPLETED',
            fileSize: '6612',
            mimeType: 'application/pdf',
            uploadedAt: createdAt,
            contractType: 'MSA',
          },
        ],
        pagination: {
          total: 1,
          limit: 5,
          page: 1,
          totalPages: 1,
          hasMore: false,
          hasPrevious: false,
        },
      },
      meta: { cached: false },
    });
  });

  await page.route(`**/api/contracts/${contractId}/artifacts/stream`, async (route) => {
    const streamArtifacts = artifacts.map((artifact) => ({
      id: artifact.id,
      type: artifact.type,
      status: 'COMPLETED',
      hasContent: true,
      contentLength: artifact.contentLength,
      metadata: artifact.metadata,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    }));

    const body = [
      { type: 'connected', contractId, timestamp: new Date().toISOString() },
      {
        type: 'update',
        contractId,
        contractStatus: 'PROCESSING',
        processingStage: 'ARTIFACT_GENERATION',
        artifacts: streamArtifacts.slice(0, Math.max(1, Math.floor(streamArtifacts.length / 2))),
      },
      {
        type: 'complete',
        contractId,
        status: 'COMPLETED',
        artifactCount: streamArtifacts.length,
        artifacts: streamArtifacts,
      },
    ]
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join('');

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
      body,
    });
  });

  return { contractId };
}
