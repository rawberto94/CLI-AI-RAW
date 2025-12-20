import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getApiTenantId } from "@/lib/tenant-server";

// Mock data for processing status (fallback)
const mockJobs = [
  {
    id: "job_001",
    contractId: "contract_001",
    filename: "service-agreement-2024.pdf",
    status: "processing",
    currentStage: "financial_analysis",
    totalProgress: 65,
    startTime: new Date(Date.now() - 5 * 60 * 1000),
    estimatedCompletion: new Date(Date.now() + 2 * 60 * 1000),
    stages: [
      {
        id: "text_extraction",
        name: "Text Extraction",
        status: "completed",
        progress: 100,
      },
      {
        id: "metadata_extraction",
        name: "Metadata Extraction",
        status: "completed",
        progress: 100,
      },
      {
        id: "financial_analysis",
        name: "Financial Analysis",
        status: "running",
        progress: 75,
      },
      {
        id: "risk_assessment",
        name: "Risk Assessment",
        status: "pending",
        progress: 0,
      },
      {
        id: "compliance_check",
        name: "Compliance Check",
        status: "pending",
        progress: 0,
      },
      {
        id: "clause_extraction",
        name: "Clause Extraction",
        status: "pending",
        progress: 0,
      },
      {
        id: "search_indexing",
        name: "Search Indexing",
        status: "pending",
        progress: 0,
      },
      {
        id: "finalization",
        name: "Finalization",
        status: "pending",
        progress: 0,
      },
    ],
    metadata: {
      fileSize: 2048576,
      uploadedBy: "roberto@company.com",
    },
  },
  {
    id: "job_002",
    contractId: "contract_002",
    filename: "purchase-order-Q1.docx",
    status: "queued",
    currentStage: "text_extraction",
    totalProgress: 0,
    startTime: new Date(Date.now() - 1 * 60 * 1000),
    stages: [
      {
        id: "text_extraction",
        name: "Text Extraction",
        status: "pending",
        progress: 0,
      },
      {
        id: "metadata_extraction",
        name: "Metadata Extraction",
        status: "pending",
        progress: 0,
      },
      {
        id: "financial_analysis",
        name: "Financial Analysis",
        status: "pending",
        progress: 0,
      },
      {
        id: "risk_assessment",
        name: "Risk Assessment",
        status: "pending",
        progress: 0,
      },
      {
        id: "compliance_check",
        name: "Compliance Check",
        status: "pending",
        progress: 0,
      },
      {
        id: "clause_extraction",
        name: "Clause Extraction",
        status: "pending",
        progress: 0,
      },
      {
        id: "search_indexing",
        name: "Search Indexing",
        status: "pending",
        progress: 0,
      },
      {
        id: "finalization",
        name: "Finalization",
        status: "pending",
        progress: 0,
      },
    ],
    metadata: {
      fileSize: 1024000,
      uploadedBy: "jane.smith@company.com",
    },
  },
  {
    id: "job_003",
    contractId: "contract_003",
    filename: "employment-contract.pdf",
    status: "completed",
    currentStage: "finalization",
    totalProgress: 100,
    startTime: new Date(Date.now() - 15 * 60 * 1000),
    stages: [
      {
        id: "text_extraction",
        name: "Text Extraction",
        status: "completed",
        progress: 100,
      },
      {
        id: "metadata_extraction",
        name: "Metadata Extraction",
        status: "completed",
        progress: 100,
      },
      {
        id: "financial_analysis",
        name: "Financial Analysis",
        status: "completed",
        progress: 100,
      },
      {
        id: "risk_assessment",
        name: "Risk Assessment",
        status: "completed",
        progress: 100,
      },
      {
        id: "compliance_check",
        name: "Compliance Check",
        status: "completed",
        progress: 100,
      },
      {
        id: "clause_extraction",
        name: "Clause Extraction",
        status: "completed",
        progress: 100,
      },
      {
        id: "search_indexing",
        name: "Search Indexing",
        status: "completed",
        progress: 100,
      },
      {
        id: "finalization",
        name: "Finalization",
        status: "completed",
        progress: 100,
      },
    ],
    metadata: {
      fileSize: 512000,
      uploadedBy: "hr@company.com",
    },
  },
];

const mockWorkers = [
  {
    id: "worker_001",
    name: "Text Extraction Worker",
    status: "active",
    currentJob: "job_001",
    processedJobs: 45,
    averageProcessingTime: 120000,
    lastActivity: new Date(),
    cpuUsage: 75,
    memoryUsage: 60,
  },
  {
    id: "worker_002",
    name: "Financial Analysis Worker",
    status: "active",
    currentJob: "job_001",
    processedJobs: 38,
    averageProcessingTime: 180000,
    lastActivity: new Date(),
    cpuUsage: 85,
    memoryUsage: 70,
  },
  {
    id: "worker_003",
    name: "Risk Assessment Worker",
    status: "idle",
    processedJobs: 42,
    averageProcessingTime: 150000,
    lastActivity: new Date(Date.now() - 2 * 60 * 1000),
    cpuUsage: 15,
    memoryUsage: 25,
  },
  {
    id: "worker_004",
    name: "Compliance Worker",
    status: "idle",
    processedJobs: 35,
    averageProcessingTime: 200000,
    lastActivity: new Date(Date.now() - 5 * 60 * 1000),
    cpuUsage: 10,
    memoryUsage: 20,
  },
];

const mockMetrics = {
  totalJobs: 156,
  activeJobs: 1,
  completedJobs: 142,
  failedJobs: 13,
  averageProcessingTime: 165000,
  throughput: 8.5,
  queueDepth: 1,
  systemLoad: 45,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");
    const jobId = searchParams.get("jobId");
    const type = searchParams.get("type") || "status";
    const tenantId = getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }

    // If requesting specific contract status
    if (contractId && type === "status") {
      // Return completed status immediately since artifacts are created during upload
      return NextResponse.json({
        success: true,
        contractId,
        status: "completed",
        currentStage: "complete",
        progress: 100,
        timestamp: new Date().toISOString(),
      });
    }

    // If requesting specific job status
    if (jobId) {
      const job = mockJobs.find((j) => j.id === jobId);
      if (job) {
        return NextResponse.json({
          success: true,
          data: job,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Get all jobs for tenant
    const jobs = mockJobs;

    let response = {};

    switch (type) {
      case "jobs":
        response = {
          success: true,
          data: jobs,
          timestamp: new Date().toISOString(),
        };
        break;

      case "workers":
        response = {
          success: true,
          data: mockWorkers,
          timestamp: new Date().toISOString(),
        };
        break;

      case "metrics":
        response = {
          success: true,
          data: {
            ...mockMetrics,
            totalJobs: jobs.length,
            activeJobs: jobs.filter((j) => j.status === "processing").length,
            completedJobs: jobs.filter((j) => j.status === "completed").length,
            failedJobs: jobs.filter((j) => j.status === "failed").length,
          },
          timestamp: new Date().toISOString(),
        };
        break;

      case "all":
      default:
        response = {
          success: true,
          data: {
            jobs: jobs.length > 0 ? jobs : mockJobs,
            workers: mockWorkers,
            metrics: mockMetrics,
          },
          timestamp: new Date().toISOString(),
        };
        break;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Processing status API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch processing status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function getContractStatus(contractId: string) {
  try {
    const contractDataPath = join(
      process.cwd(),
      "data",
      "contracts",
      `${contractId}.json`
    );
    if (existsSync(contractDataPath)) {
      const data = JSON.parse(await readFile(contractDataPath, "utf-8"));
      return {
        success: true,
        contractId,
        status: data.status,
        currentStage: data.processing?.currentStage,
        progress: data.processing?.progress || 0,
        jobId: data.processing?.jobId,
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  } catch (error) {
    console.error("Error reading contract status:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobId, data } = body;
    const tenantId = getApiTenantId(request);
    
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 200));

    let response = {};

    switch (action) {
      case "pause_job":
        response = {
          success: true,
          message: `Job ${jobId} paused successfully`,
          timestamp: new Date().toISOString(),
        };
        break;

      case "resume_job":
        response = {
          success: true,
          message: `Job ${jobId} resumed successfully`,
          timestamp: new Date().toISOString(),
        };
        break;

      case "cancel_job":
        response = {
          success: true,
          message: `Job ${jobId} cancelled successfully`,
          timestamp: new Date().toISOString(),
        };
        break;

      case "retry_job":
        response = {
          success: true,
          message: `Job ${jobId} queued for retry`,
          timestamp: new Date().toISOString(),
        };
        break;

      case "restart_worker":
        response = {
          success: true,
          message: `Worker ${data.workerId} restarted successfully`,
          timestamp: new Date().toISOString(),
        };
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
            validActions: [
              "pause_job",
              "resume_job",
              "cancel_job",
              "retry_job",
              "restart_worker",
            ],
          },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Processing status action error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
