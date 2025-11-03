/**
 * Authentication stub
 * TODO: Implement actual authentication with NextAuth or similar
 */

export interface Session {
  user: {
    id: string;
    email?: string;
    name?: string;
    tenantId: string;
  };
}

export const authOptions = {
  // Stub auth options for NextAuth
  providers: [],
  callbacks: {},
};

export async function getServerSession(): Promise<Session | null> {
  // Stub: Return demo session
  return {
    user: {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      tenantId: 'demo',
    },
  };
}

export function requireAuth(session: Session | null) {
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
