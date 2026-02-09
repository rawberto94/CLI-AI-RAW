/**
 * NextAuth v5 Configuration
 * Production-ready authentication with JWT, Prisma, and SSO Support
 * 
 * Supports:
 * - Email/Password (Credentials)
 * - Google SSO
 * - Microsoft/Azure AD SSO
 * - GitHub SSO
 * 
 * Security features:
 * - MFA enforcement in login flow (C1 fix)
 * - JWT token rotation with hourly re-validation (H9 fix)
 * - Account lockout with exponential backoff
 * - Comprehensive audit logging
 * - Proper type augmentation (L17 fix)
 */

import NextAuth, { type NextAuthConfig, type Account, type Profile } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import crypto from "crypto";
import { getAccountLockout } from "@/lib/security/account-lockout";
import { auditLog, AuditAction } from "@/lib/security/audit";

// ============================================================================
// NextAuth Module Augmentation (L17 fix — replaces `as any` casts)
// ============================================================================

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

declare module "next-auth/jwt" {
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

// ============================================================================
// MFA Verification Token (HMAC-signed for secure JWT update)
// ============================================================================

const MFA_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a signed MFA verification token.
 * Used to securely propagate MFA verification into the JWT via session update.
 */
export function generateMfaVerificationToken(userId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  const payload = JSON.stringify({ userId, timestamp: Date.now() });
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

/**
 * Verify a signed MFA verification token.
 */
export function verifyMfaVerificationToken(token: string, expectedUserId: string): boolean {
  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const dotIndex = decoded.lastIndexOf(".");
    if (dotIndex === -1) return false;

    const payload = decoded.substring(0, dotIndex);
    const signature = decoded.substring(dotIndex + 1);

    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return false;
    }

    const data = JSON.parse(payload);
    if (data.userId !== expectedUserId) return false;
    if (Date.now() - data.timestamp > MFA_TOKEN_TTL) return false;

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// JWT Rotation Interval (H9 fix)
// ============================================================================

const TOKEN_REFRESH_INTERVAL = 60 * 60 * 1000; // Re-validate every 1 hour

// Build providers array based on environment configuration
const providers: NextAuthConfig["providers"] = [];

// Always include Credentials provider
providers.push(
  CredentialsProvider({
    id: "credentials",
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const email = credentials.email as string;

      try {
        // --- Account Lockout Check ---
        const lockout = getAccountLockout();
        const isLocked = await lockout.isLocked(email);
        if (isLocked) {
          await auditLog({
            action: AuditAction.LOGIN_FAILED,
            userEmail: email,
            metadata: { reason: 'account_locked' },
            success: false,
            errorMessage: 'Account temporarily locked due to too many failed attempts',
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { tenant: true },
        });

        if (!user || !user.passwordHash) {
          // Record failed attempt even for non-existent users (prevents user enumeration timing)
          await lockout.recordFailedAttempt(email, 'unknown').catch(() => {});
          await auditLog({
            action: AuditAction.LOGIN_FAILED,
            userEmail: email,
            metadata: { reason: 'invalid_credentials' },
            success: false,
          }).catch(() => {});
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          await lockout.recordFailedAttempt(email, 'unknown').catch(() => {});
          await auditLog({
            action: AuditAction.LOGIN_FAILED,
            userId: user.id,
            userEmail: email,
            tenantId: user.tenantId,
            metadata: { reason: 'invalid_password' },
            success: false,
          }).catch(() => {});
          return null;
        }

        if (user.status !== "ACTIVE") {
          await auditLog({
            action: AuditAction.LOGIN_FAILED,
            userId: user.id,
            userEmail: email,
            tenantId: user.tenantId,
            metadata: { reason: 'account_inactive', status: user.status },
            success: false,
            errorMessage: `Account status: ${user.status}`,
          }).catch(() => {});
          return null;
        }

        // Successful login — reset lockout counter & audit log
        await lockout.recordSuccessfulLogin(email, 'unknown').catch(() => {});
        await auditLog({
          action: AuditAction.LOGIN_SUCCESS,
          userId: user.id,
          userEmail: email,
          tenantId: user.tenantId,
          metadata: { provider: 'credentials', mfaRequired: user.mfaEnabled },
          success: true,
        }).catch(() => {});

        // C1 FIX: Flag MFA requirement in the returned user object
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          tenantId: user.tenantId,
          role: user.role,
          image: user.avatar || undefined,
          mfaRequired: user.mfaEnabled,
        };
      } catch (error) {
        // L16 FIX: Log errors instead of silently swallowing them
        console.error('[Auth] authorize() error:', error instanceof Error ? error.message : error);
        return null;
      }
    },
  })
);

// Google SSO (if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    })
  );
}

// Microsoft Entra ID / Azure AD SSO (if configured)
if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    })
  );
}

// GitHub SSO (if configured)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  );
}

/**
 * Handle SSO user linking/creation
 * Maps SSO users to existing users by email or creates new ones
 */
async function handleSSOSignIn(
  account: Account | null,
  profile: Profile | undefined,
  email: string | null | undefined
): Promise<{ tenantId: string; role: string } | null> {
  if (!email) return null;

  // Try to find existing user by email
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, tenantId: true, role: true, status: true },
  });

  if (existingUser) {
    if (existingUser.status !== "ACTIVE") {
      return null;
    }
    return { tenantId: existingUser.tenantId, role: existingUser.role };
  }

  // Check for pending invitation
  const invitation = await prisma.teamInvitation.findFirst({
    where: {
      email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });

  if (invitation) {
    // Auto-join the tenant from invitation
    return { tenantId: invitation.tenantId, role: invitation.role };
  }

  // No existing user or invitation - check if auto-provisioning is enabled
  const autoProvision = process.env.SSO_AUTO_PROVISION === "true";
  const defaultTenantId = process.env.SSO_DEFAULT_TENANT_ID;

  if (autoProvision && defaultTenantId) {
    return { tenantId: defaultTenantId, role: "member" };
  }

  // Deny access - user must be pre-created or invited
  return null;
}

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as NextAuthConfig["adapter"],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Credentials provider handles its own validation
      if (account?.provider === "credentials") {
        return true;
      }

      // SSO providers - check if user is allowed
      const ssoMapping = await handleSSOSignIn(account ?? null, profile, user.email);
      if (!ssoMapping) {
        return false; // Deny access
      }

      // Store tenant info for JWT callback (type-safe via module augmentation)
      user.tenantId = ssoMapping.tenantId;
      user.role = ssoMapping.role;

      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.provider = account?.provider;
        // C1 FIX: Store MFA state in JWT
        token.mfaRequired = user.mfaRequired ?? false;
        token.mfaVerified = user.mfaRequired ? false : true; // If no MFA required, auto-verify
        token.lastValidated = Date.now();
      }

      // Handle session update (MFA verification propagation)
      if (trigger === "update" && session?.mfaVerificationToken) {
        // Verify the HMAC-signed token server-side before trusting it
        if (token.id && verifyMfaVerificationToken(session.mfaVerificationToken, token.id)) {
          token.mfaVerified = true;
        }
      }

      // H9 FIX: Token rotation — re-validate user from database periodically
      if (token.id && token.lastValidated) {
        const timeSinceValidation = Date.now() - token.lastValidated;
        if (timeSinceValidation > TOKEN_REFRESH_INTERVAL) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { id: true, tenantId: true, role: true, status: true, mfaEnabled: true },
            });

            if (!dbUser || dbUser.status !== "ACTIVE") {
              // User deactivated/deleted — invalidate token
              return {} as typeof token;
            }

            // Refresh token data from DB
            token.tenantId = dbUser.tenantId;
            token.role = dbUser.role;
            token.mfaRequired = dbUser.mfaEnabled;
            token.lastValidated = Date.now();
          } catch (error) {
            console.error("[Auth] Token rotation query failed:", error);
            // Don't invalidate on transient DB errors, just skip refresh
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.provider = token.provider as string;
        // C1 FIX: Expose MFA state in session
        session.user.mfaRequired = token.mfaRequired ?? false;
        session.user.mfaVerified = token.mfaVerified ?? true;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      // Update last login time
      try {
        if (user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        }
      } catch {
        // User might not exist yet for SSO (will be created by adapter)
      }
    },
    async signOut() {
      // User signed out — can add cleanup here
    },
    async createUser({ user }) {
      // New user created by adapter (SSO first login)
      console.log('[Auth] New SSO user created:', user.email);
    },
    async linkAccount({ user, account }) {
      // Account linked to existing user
      console.log('[Auth] Account linked:', account.provider, '→', user.email);
    },
  },
  debug: process.env.NODE_ENV === "development",
};

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);

// L18 FIX: Export auth directly (no unnecessary wrapper function)
export const getServerSession = auth;

export function requireAuth(session: unknown) {
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Get list of configured SSO providers for UI
 */
export function getConfiguredProviders(): string[] {
  const configured: string[] = ["credentials"];
  
  if (process.env.GOOGLE_CLIENT_ID) configured.push("google");
  if (process.env.AZURE_AD_CLIENT_ID) configured.push("microsoft-entra-id");
  if (process.env.GITHUB_CLIENT_ID) configured.push("github");
  
  return configured;
}
