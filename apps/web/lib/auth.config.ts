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

export const authConfig = {
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Prevent Auth.js from auto-detecting HTTPS (via X-Forwarded-Proto) and
  // prefixing cookie names with "__Secure-".  This is critical when running
  // behind VS Code port forwarding or any reverse proxy that upgrades to HTTPS.
  useSecureCookies: false,
  // Force plain cookie names (no __Secure- prefix) so that sessions work
  // consistently regardless of whether a reverse proxy (VS Code port forwarding,
  // nginx, etc.) adds X-Forwarded-Proto: https headers.
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
      },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
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
