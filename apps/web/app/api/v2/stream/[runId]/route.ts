import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const params = await context.params
  const url = process.env['NEXT_PUBLIC_API_BASE'] || 'http://localhost:3001';
  const res = await fetch(`${url}/api/v2/stream/${params.runId}`);
  const headers = new Headers(res.headers);
  const stream = res.body as any;
  return new Response(stream, { status: res.status, headers });
}
