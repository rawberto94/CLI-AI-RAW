/**
 * NextAuth Route Handler Stub
 * TODO: Implement actual NextAuth configuration
 */

import { authOptions } from '@/lib/auth';

// Stub: NextAuth would handle GET/POST here
export async function GET(request: Request) {
  return new Response(JSON.stringify({ error: 'Auth not configured' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request) {
  return new Response(JSON.stringify({ error: 'Auth not configured' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}

export { authOptions };
