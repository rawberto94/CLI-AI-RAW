/**
 * List Available Auth Providers API
 * Returns list of configured SSO providers for the login UI
 */

import { NextResponse } from "next/server";
import { getConfiguredProviders } from "@/lib/auth";

export async function GET() {
  try {
    const providers = getConfiguredProviders();
    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error getting providers:", error);
    return NextResponse.json({ providers: ["credentials"] });
  }
}
