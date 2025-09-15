export const dynamic = 'force-dynamic';

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  const params = await context.params
  const url = process.env['NEXT_PUBLIC_API_BASE'] || 'http://localhost:3001';
  const res = await fetch(`${url}/api/v2/runs/${params.runId}`);
  const headers = new Headers(res.headers);
  const body = await res.text();
  return new Response(body, { status: res.status, headers });
}
