/**
 * Upload API - Redirect to /api/contracts/upload
 * 
 * This is a compatibility route that forwards requests to the main upload endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Get the full URL and replace the path
  const url = new URL(request.url);
  url.pathname = "/api/contracts/upload";

  // Forward the request to the correct endpoint
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: request.headers,
    body: await request.blob(),
    // @ts-expect-error - duplex is needed for streaming body
    duplex: "half",
  });

  // Return the response from the correct endpoint with proper CORS
  const data = await response.json();
  const jsonResponse = NextResponse.json(data, { status: response.status });
  return cors.addCorsHeaders(jsonResponse, request, "POST, OPTIONS");
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, "POST, OPTIONS");
}
