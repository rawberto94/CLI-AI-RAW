// @ts-nocheck
/**
 * NextAuth v5 Configuration
 * Production-ready authentication with JWT and Prisma
 */

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: {
              tenant: true,
            },
          });

          if (!user || !user.passwordHash) {
            console.log("User not found or no password set");
            return null;
          }

          // Verify password
          const isPasswordValid = await compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isPasswordValid) {
            console.log("Invalid password");
            return null;
          }

          // Check if user is active
          if (user.status !== "ACTIVE") {
            console.log("User account is not active");
            return null;
          }

          // Return user object that will be stored in JWT
          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            tenantId: user.tenantId,
            role: 'user',
            image: user.avatar || undefined,
          };
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      // Add custom properties to session
      if (token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      console.log("User signed in:", { userId: user.id, email: user.email });
      
      // Update last login time
      try {
        if (user.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        }
      } catch (error) {
        console.error("Failed to update last login time:", error);
      }
    },
    async signOut({ token }) {
      console.log("User signed out:", { userId: token?.id });
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
