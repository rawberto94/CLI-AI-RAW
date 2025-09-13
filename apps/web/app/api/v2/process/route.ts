import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
  const res = await fetch(`${url}/api/v2/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // For streaming, we simply return the response as-is
  const headers = new Headers(res.headers);
  const stream = res.body as any;
  return new Response(stream, { status: res.status, headers });
}
