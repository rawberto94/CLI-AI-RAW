import { NextRequest } from "next/server";
import { db as _db } from "@/lib/db";
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  // Get all saved report templates
  // In production, store these in a database table
  const templates = [
    {
      id: "1",
      name: "Monthly Supplier Performance",
      type: "supplier",
      fields: ["supplier_name", "active_contracts", "total_spend", "avg_performance"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "Rate Card Analysis",
      type: "rate-card",
      fields: ["role_name", "seniority", "avg_rate", "rate_count"],
      createdAt: new Date().toISOString(),
    },
  ];

  return createSuccessResponse(ctx, { templates });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const template = await request.json();

  // In production, save to database
  // For now, just return success
  return createSuccessResponse(ctx, {
    template: {
      id: Date.now().toString(),
      ...template,
      createdAt: new Date().toISOString(),
    },
  });
});
