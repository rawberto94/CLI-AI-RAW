/**
 * NextAuth v5 Route Handler
 * Handles all authentication requests
 */

import { handlers } from "@/lib/auth";

// NextAuth handlers - managed by auth.ts
export const { GET, POST } = handlers;
