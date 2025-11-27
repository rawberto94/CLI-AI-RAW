/**
 * Upload API - Redirect to /api/contracts/upload
 * 
 * This is a compatibility route that forwards requests to the main upload endpoint.
 */

import { NextRequest, NextResponse } from "next/server";

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

  // Return the response from the correct endpoint
  const data = await response.json();
  return NextResponse.json(data, { 
    status: response.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id, x-data-mode",
    }
  });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id, x-data-mode",
      "Access-Control-Max-Age": "86400",
    },
  });
}
