/**
 * Debug Login API - Bypasses NextAuth to test password directly
 * This is for debugging only - should be removed in production
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import * as bcryptPkg from "bcryptjs";

// SECURITY: This endpoint leaks password hash metadata and acts as an
// unauthenticated password-verification oracle. Production deployments MUST
// return 404 so the route is indistinguishable from a non-existent path.
const isProductionLocked =
  process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true';

export async function POST(request: NextRequest) {
  if (isProductionLocked) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Test 1: Find user
    console.log('[Debug] Looking up user:', email);
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        firstName: true,
        lastName: true,
        tenantId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: "User not found",
        debug: { email, userFound: false }
      }, { status: 404 });
    }

    // Test 2: Check passwordHash exists
    if (!user.passwordHash) {
      return NextResponse.json({ 
        success: false, 
        error: "No password hash stored",
        debug: { 
          email, 
          userFound: true,
          hasPasswordHash: false,
          userId: user.id,
        }
      }, { status: 400 });
    }

    // Test 3: Compare password
    console.log('[Debug] Comparing password:', {
      inputPasswordLength: password.length,
      storedHashLength: user.passwordHash.length,
      storedHashPrefix: user.passwordHash.substring(0, 10),
    });

    const isValid = await compare(password, user.passwordHash);

    // Test 4: Also hash the input and compare
    const newHash = await hash(password, 12);

    return NextResponse.json({
      success: isValid,
      debug: {
        email,
        userFound: true,
        hasPasswordHash: true,
        passwordHashLength: user.passwordHash.length,
        passwordHashPrefix: user.passwordHash.substring(0, 10),
        passwordHashSuffix: user.passwordHash.substring(user.passwordHash.length - 5),
        inputPasswordLength: password.length,
        comparisonResult: isValid,
        newHashPrefix: newHash.substring(0, 10),
        status: user.status,
        userId: user.id,
        firstName: user.firstName,
        // bcryptjs info
        bcryptjsLoaded: typeof compare === 'function',
      }
    });

  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ 
      error: "Server error", 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

// Also add GET for easy browser testing
export async function GET() {
  if (isProductionLocked) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({
    message: "Debug login test endpoint. POST with { email, password } to test.",
    bcryptjsLoaded: typeof compare === 'function',
  });
}
