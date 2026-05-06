import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      tenantId: string;
      role: string;
      provider?: string;
      userSessionId?: string;
      sessionExpiresAt?: string;
      mfaRequired: boolean;
      mfaVerified: boolean;
    };
  }

  interface User {
    tenantId?: string;
    role?: string;
    mfaRequired?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    role?: string;
    provider?: string;
    userSessionId?: string;
    lastActiveAt?: number;
    sessionExpiresAt?: number;
    mfaRequired?: boolean;
    mfaVerified?: boolean;
    lastValidated?: number;
  }
}
