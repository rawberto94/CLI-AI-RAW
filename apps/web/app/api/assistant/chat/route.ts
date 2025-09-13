import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 30;

// Proxy assistant chat to the backend API to avoid CORS and centralize base URL
export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const docId = typeof payload?.docId === 'string' && payload.docId.trim().length > 0 ? payload.docId : undefined;
    if (messages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const resp = await fetch(`${API_BASE_URL}/api/v2/assistant/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, docId }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const text = await resp.text().catch(() => "");
    // Pass through successful JSON; otherwise bubble a concise error
    if (resp.ok) {
      try {
        return NextResponse.json(JSON.parse(text));
      } catch {
        return NextResponse.json({ content: text });
      }
    }
    return NextResponse.json(
      { error: `Backend chat failed: ${resp.status} ${text.slice(0, 500)}` },
      { status: 502 }
    );
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    return NextResponse.json(
      { error: isAbort ? "Chat timed out" : (e?.message || "Chat failed") },
      { status: isAbort ? 504 : 500 }
    );
  }
}
