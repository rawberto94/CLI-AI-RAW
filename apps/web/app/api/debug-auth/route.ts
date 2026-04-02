import { NextRequest, NextResponse } from "next/server";
import { decode } from "next-auth/jwt";

/**
 * Temporary diagnostic endpoint — reports what cookies and headers 
 * the middleware sees. No auth required so the browser can reach it
 * even when session cookies aren't working.
 */
export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [name] = c.split("=");
      return name;
    });

  // Try to decode the session token
  const sessionCookie = req.cookies.get("authjs.session-token")?.value 
    || req.cookies.get("__Secure-authjs.session-token")?.value;
  
  let tokenDecodeResult: string = "no-token";
  let tokenPayload: Record<string, unknown> | null = null;
  
  if (sessionCookie) {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      tokenDecodeResult = "no-secret-env-var";
    } else {
      try {
        const decoded = await decode({
          token: sessionCookie,
          secret,
          salt: "authjs.session-token",
        });
        if (decoded) {
          tokenDecodeResult = "success";
          tokenPayload = {
            id: decoded.id,
            tenantId: decoded.tenantId,
            role: decoded.role,
            exp: decoded.exp,
            iat: decoded.iat,
          } as Record<string, unknown>;
        } else {
          tokenDecodeResult = "decode-returned-null";
        }
      } catch (e) {
        tokenDecodeResult = `decode-error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }

  return NextResponse.json({
    cookies,
    hasCookieHeader: cookieHeader.length > 0,
    hasSessionCookie: cookieHeader.includes("authjs.session-token"),
    hasSecureCookie: cookieHeader.includes("__Secure-authjs.session-token"),
    tokenDecode: tokenDecodeResult,
    tokenPayload,
    tokenLength: sessionCookie?.length || 0,
    secretPresent: !!(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET),
    secretLength: (process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "").length,
    headers: {
      host: req.headers.get("host"),
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      "x-forwarded-proto": req.headers.get("x-forwarded-proto"),
      "x-forwarded-host": req.headers.get("x-forwarded-host"),
      "x-forwarded-for": req.headers.get("x-forwarded-for"),
    },
  });
}
