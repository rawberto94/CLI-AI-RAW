import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email-service';
import { publishRealtimeEvent } from '@/lib/realtime/publish';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/signatures/[id]/sign?token=...
 * Validate a signing token and return signer info + contract details.
 * This is a PUBLIC endpoint (no auth required — token is the credential).
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: requestId } = await params;
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Signing token is required' }, { status: 400 });
    }

    // Decode token
    let tokenData: { contractId?: string; email?: string; exp?: number; requestId?: string };
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      tokenData = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid signing token' }, { status: 400 });
    }

    // Check expiry
    if (tokenData.exp && tokenData.exp < Date.now()) {
      return NextResponse.json({ success: false, error: 'This signing link has expired. Please request a new one.' }, { status: 410 });
    }

    if (!tokenData.email) {
      return NextResponse.json({ success: false, error: 'Invalid token: missing signer information' }, { status: 400 });
    }

    // Find the signature request
    const sigRequest = await prisma.signatureRequest.findFirst({
      where: { id: requestId },
      include: {
        contract: {
          select: { id: true, contractTitle: true, originalName: true, fileName: true },
        },
      },
    });

    if (!sigRequest) {
      return NextResponse.json({ success: false, error: 'Signature request not found' }, { status: 404 });
    }

    if (sigRequest.status === 'completed') {
      return NextResponse.json({ success: false, error: 'This document has already been fully signed' }, { status: 400 });
    }

    if (sigRequest.status === 'cancelled' || sigRequest.status === 'voided') {
      return NextResponse.json({ success: false, error: 'This signing request has been cancelled' }, { status: 400 });
    }

    // Find the signer in the signers array
    const signers = (sigRequest.signers as Array<Record<string, unknown>>) || [];
    const signer = signers.find((s) => (s.email as string)?.toLowerCase() === tokenData.email?.toLowerCase());

    if (!signer) {
      return NextResponse.json({ success: false, error: 'You are not a signer on this document' }, { status: 403 });
    }

    if (signer.status === 'signed') {
      return NextResponse.json({ success: false, error: 'You have already signed this document' }, { status: 400 });
    }

    if (signer.status === 'declined') {
      return NextResponse.json({ success: false, error: 'You have already declined to sign this document' }, { status: 400 });
    }

    const contractTitle = sigRequest.contract?.contractTitle
      || sigRequest.contract?.originalName
      || sigRequest.contract?.fileName
      || 'Untitled Document';

    // Mark signer as "viewed"
    const updatedSigners = signers.map((s) => {
      if ((s.email as string)?.toLowerCase() === tokenData.email?.toLowerCase() && s.status === 'sent') {
        return { ...s, status: 'viewed', viewedAt: new Date().toISOString() };
      }
      return s;
    });

    await prisma.signatureRequest.update({
      where: { id: requestId },
      data: { signers: updatedSigners, updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        name: signer.name as string,
        email: signer.email as string,
        role: signer.role as string,
        contractTitle,
        contractId: sigRequest.contractId,
        requestId: sigRequest.id,
        subject: sigRequest.subject || 'Signature Request',
        message: sigRequest.message || '',
        expiresAt: sigRequest.expiresAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Signing validation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/signatures/[id]/sign
 * Submit a signature or decline.
 * This is a PUBLIC endpoint (no auth required — token is the credential).
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: requestId } = await params;
    const body = await request.json();
    const { token, action, signatureMethod, signatureData, agreedToTerms, declineReason } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Signing token is required' }, { status: 400 });
    }

    // Decode token
    let tokenData: { contractId?: string; email?: string; exp?: number };
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      tokenData = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid signing token' }, { status: 400 });
    }

    if (tokenData.exp && tokenData.exp < Date.now()) {
      return NextResponse.json({ success: false, error: 'This signing link has expired' }, { status: 410 });
    }

    if (!tokenData.email) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 });
    }

    // Find the signature request
    const sigRequest = await prisma.signatureRequest.findFirst({
      where: { id: requestId },
      include: {
        contract: {
          select: { id: true, contractTitle: true, originalName: true, fileName: true, tenantId: true },
        },
      },
    });

    if (!sigRequest) {
      return NextResponse.json({ success: false, error: 'Signature request not found' }, { status: 404 });
    }

    if (sigRequest.status === 'completed' || sigRequest.status === 'cancelled') {
      return NextResponse.json({ success: false, error: `This request is already ${sigRequest.status}` }, { status: 400 });
    }

    const signers = (sigRequest.signers as Array<Record<string, unknown>>) || [];
    const signerIndex = signers.findIndex((s) => (s.email as string)?.toLowerCase() === tokenData.email?.toLowerCase());

    if (signerIndex === -1) {
      return NextResponse.json({ success: false, error: 'You are not a signer on this document' }, { status: 403 });
    }

    const signer = signers[signerIndex];
    if (signer.status === 'signed' || signer.status === 'declined') {
      return NextResponse.json({ success: false, error: `You have already ${signer.status} this document` }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === 'decline') {
      // Decline
      const updatedSigners = [...signers];
      updatedSigners[signerIndex] = {
        ...signer,
        status: 'declined',
        declinedAt: now,
        declineReason: declineReason || 'No reason provided',
      };

      await prisma.signatureRequest.update({
        where: { id: requestId },
        data: {
          signers: updatedSigners,
          status: 'declined',
          updatedAt: new Date(),
          metadata: {
            ...((sigRequest.metadata as Record<string, unknown>) || {}),
            declinedBy: tokenData.email,
            declinedAt: now,
          },
        },
      });

      // Notify the creator
      try {
        void publishRealtimeEvent({
          event: 'signature:declined',
          data: {
            tenantId: sigRequest.tenantId,
            contractId: sigRequest.contractId,
            requestId: sigRequest.id,
            signerEmail: tokenData.email,
          },
          source: 'api:signatures:sign',
        });
      } catch { /* best effort */ }

      return NextResponse.json({
        success: true,
        message: 'You have declined to sign this document. The sender has been notified.',
      });
    }

    // Sign
    if (!agreedToTerms) {
      return NextResponse.json({ success: false, error: 'You must agree to the terms to sign' }, { status: 400 });
    }

    if (!signatureData) {
      return NextResponse.json({ success: false, error: 'Signature is required' }, { status: 400 });
    }

    const updatedSigners = [...signers];
    updatedSigners[signerIndex] = {
      ...signer,
      status: 'signed',
      signedAt: now,
      signatureMethod: signatureMethod || 'typed',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    };

    // Check if all signers have signed
    const allSigned = updatedSigners
      .filter((s) => s.role !== 'cc')
      .every((s) => s.status === 'signed');

    const newRequestStatus = allSigned ? 'completed' : 'in_progress';

    await prisma.signatureRequest.update({
      where: { id: requestId },
      data: {
        signers: updatedSigners,
        status: newRequestStatus,
        ...(allSigned ? { completedAt: new Date() } : {}),
        updatedAt: new Date(),
        metadata: {
          ...((sigRequest.metadata as Record<string, unknown>) || {}),
          [`signed_${tokenData.email}`]: {
            method: signatureMethod,
            timestamp: now,
          },
        },
      },
    });

    // If all signed, update contract signature status
    if (allSigned) {
      await prisma.contract.update({
        where: { id: sigRequest.contractId },
        data: {
          signatureStatus: 'signed',
          updatedAt: new Date(),
        },
      });
    }

    // Publish realtime event
    try {
      void publishRealtimeEvent({
        event: allSigned ? 'signature:completed' : 'signature:signed',
        data: {
          tenantId: sigRequest.tenantId,
          contractId: sigRequest.contractId,
          requestId: sigRequest.id,
          signerEmail: tokenData.email,
          allSigned,
        },
        source: 'api:signatures:sign',
      });
    } catch { /* best effort */ }

    // Send confirmation email to the signer
    try {
      const contractTitle = sigRequest.contract?.contractTitle || sigRequest.contract?.originalName || 'document';
      await sendEmail({
        to: tokenData.email,
        subject: `✅ You have signed: ${contractTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">✅ Document Signed</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #1f2937;">Hi ${signer.name || 'there'},</p>
              <p style="color: #4b5563;">Your signature has been successfully recorded for:</p>
              <div style="background: white; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 4px;">
                <strong style="color: #1f2937;">${contractTitle}</strong>
                <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">
                  Signed on ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
                </p>
              </div>
              <p style="color: #6b7280; font-size: 14px;">This is your confirmation receipt. Please keep it for your records.</p>
            </div>
            <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px;">
              <p>ConTigo CLM Platform</p>
            </div>
          </div>
        `,
      });
    } catch { /* best effort */ }

    return NextResponse.json({
      success: true,
      message: allSigned
        ? 'All signatures collected! The document is now fully signed.'
        : 'Your signature has been recorded successfully.',
      allSigned,
    });
  } catch (error) {
    console.error('Signing submission error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
