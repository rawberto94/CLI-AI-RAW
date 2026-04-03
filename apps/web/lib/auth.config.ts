/**
 * Edge-compatible NextAuth configuration
 * 
 * This file contains only the config parts that are safe for Edge Runtime
 * (no Prisma, no Node.js-only modules). Used by middleware.ts.
 * 
 * The full config with adapter/providers lives in auth.ts.
 */

import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface User {
    tenantId?: string;
    role?: string;
    mfaRequired?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      tenantId: string;
      role: string;
      provider?: string;
      mfaRequired: boolean;
      mfaVerified: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    role?: string;
    provider?: string;
    mfaRequired?: boolean;
    mfaVerified?: boolean;
    lastValidated?: number;
  }
}

const isProduction = process.env.NODE_ENV === 'production';
const useSecure = isProduction && process.env.DISABLE_SECURE_COOKIES !== 'true';
if (isProduction && process.env.DISABLE_SECURE_COOKIES === 'true') {
  console.warn('[SECURITY] DISABLE_SECURE_COOKIES is set in production — cookie Secure flag is OFF. Only use behind an HTTP-only load balancer.');
}

export const authConfig = {
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 24 hours — short-lived for sensitive contract data
  },
  // In production, enable secure cookies for HTTPS.
  // In development, keep plain cookie names to avoid __Secure- prefix issues
  // with VS Code port forwarding and reverse proxies.
  useSecureCookies: useSecure,
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
      },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
      },
    },
  },
  // Providers are configured in auth.ts — keep empty here for Edge compatibility
  providers: [],
  callbacks: {
    // Session callback (Edge-safe — just reads JWT, no DB calls)
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.provider = token.provider as string;
        session.user.mfaRequired = (token.mfaRequired as boolean | undefined) ?? false;
        session.user.mfaVerified = (token.mfaVerified as boolean | undefined) ?? true;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
