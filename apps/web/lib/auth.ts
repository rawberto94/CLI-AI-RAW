/**
 * NextAuth v5 Configuration
 * Production-ready authentication with JWT, Prisma, and SSO Support
 * 
 * Supports:
 * - Email/Password (Credentials)
 * - Google SSO
 * - Microsoft/Azure AD SSO
 * - GitHub SSO
 * - SAML (via custom provider - requires additional setup)
 */

import NextAuth, { type NextAuthConfig, type Account, type Profile } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

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

      try {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { tenant: true },
        });

        if (!user || !user.passwordHash) {
          console.log("User not found or no password set");
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          console.log("Invalid password");
          return null;
        }

        if (user.status !== "ACTIVE") {
          console.log("User account is not active");
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          tenantId: user.tenantId,
          role: user.role,
          image: user.avatar || undefined,
        };
      } catch (error) {
        console.error("Authorization error:", error);
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
      console.log("SSO user account is not active:", email);
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
  console.log("SSO user not found and auto-provisioning disabled:", email);
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

      // Store tenant info for JWT callback
      (user as any).tenantId = ssoMapping.tenantId;
      (user as any).role = ssoMapping.role;

      return true;
    },
    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.provider = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        (session.user as any).role = token.role as string;
        (session.user as any).provider = token.provider as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log("User signed in:", { 
        userId: user.id, 
        email: user.email,
        provider: account?.provider,
      });
      
      // Update last login time
      try {
        if (user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        }
      } catch (error) {
        // User might not exist yet for SSO (will be created by adapter)
        console.debug("Failed to update last login time:", error);
      }
    },
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      console.log("User signed out:", { userId: token?.id });
    },
    async createUser({ user }) {
      // Log new user creation (especially for SSO)
      console.log("New user created:", { userId: user.id, email: user.email });
    },
    async linkAccount({ user, account }) {
      console.log("Account linked:", { 
        userId: user.id, 
        provider: account.provider,
      });
    },
  },
  debug: process.env.NODE_ENV === "development",
};

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);

// Helper function for backward compatibility
export async function getServerSession() {
  return await auth();
}

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
