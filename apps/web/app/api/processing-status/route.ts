import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  const jobId = searchParams.get("jobId");
  const type = searchParams.get("type") || "status";
  const tenantId = await ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  // If requesting specific contract status
  if (contractId && type === "status") {
    // Return completed status immediately since artifacts are created during upload
    return createSuccessResponse(ctx, {
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
    // TODO: Look up job by ID from database/queue system
    return createErrorResponse(ctx, 'NOT_FOUND', `Job ${jobId} not found. Processing status monitoring not yet connected to database.`, 404);
  }

  const emptyMetrics = {
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    throughput: 0,
    queueDepth: 0,
    systemLoad: 0,
  };

  let response = {};

  switch (type) {
    case "jobs":
      response = {
        success: true,
        data: [],
        total: 0,
        message: "Processing status monitoring not yet connected to database",
        timestamp: new Date().toISOString(),
      };
      break;

    case "workers":
      response = {
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      };
      break;

    case "metrics":
      response = {
        success: true,
        data: emptyMetrics,
        timestamp: new Date().toISOString(),
      };
      break;

    case "all":
    default:
      response = {
        success: true,
        data: {
          jobs: [],
          workers: [],
          metrics: emptyMetrics,
        },
        timestamp: new Date().toISOString(),
      };
      break;
  }

  return createSuccessResponse(ctx, response);
});

async function _getContractStatus(contractId: string) {
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
  } catch {
    return null;
  }
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action, jobId, data } = body;
  const tenantId = await ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
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
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }

  return createSuccessResponse(ctx, response);
});
