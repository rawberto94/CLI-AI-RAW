/**
 * Safety Appeal Endpoint
 *
 * Receives user appeals for messages blocked by input guardrails. Logs the
 * appeal to the audit trail so compliance reviewers can inspect false
 * positives. Does NOT re-run the blocked prompt through the model.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { auditLog, AuditAction } from "@/lib/security/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { originalMessage, reason, category, userNotes } = body ?? {};

    if (typeof originalMessage !== "string" || originalMessage.length === 0) {
      return NextResponse.json({ error: "Missing originalMessage" }, { status: 400 });
    }

    const tenantId = (session.user as { tenantId?: string }).tenantId;

    await auditLog({
      action: AuditAction.AI_SAFETY_APPEAL,
      resourceType: "chat_message",
      resourceId: undefined,
      userId: session.user.id,
      tenantId,
      metadata: {
        reason: reason ?? null,
        category: category ?? null,
        userNotes: typeof userNotes === "string" ? userNotes.slice(0, 2000) : null,
        messagePreview: originalMessage.slice(0, 500),
        messageLength: originalMessage.length,
      },
    }).catch((e) => {
      console.error("[safety-appeal] audit failed", e);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[safety-appeal] error", error);
    return NextResponse.json({ error: "Failed to submit appeal" }, { status: 500 });
  }
}
