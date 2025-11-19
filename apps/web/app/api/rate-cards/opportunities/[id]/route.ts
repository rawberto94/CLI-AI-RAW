import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { SavingsOpportunityService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const service = new SavingsOpportunityService(prisma);
    const opportunity = await service.getOpportunityDetails(params.id);

    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      opportunity,
    });
  } catch (error: any) {
    console.error('Error fetching opportunity details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const { status, notes, assignedTo, actualSavings } = body;

    const service = new SavingsOpportunityService(prisma);

    if (actualSavings !== undefined) {
      await service.trackRealizedSavings(params.id, actualSavings);
    } else {
      await service.updateOpportunityStatus(params.id, status, notes, assignedTo);
    }

    const updated = await service.getOpportunityDetails(params.id);

    return NextResponse.json({
      success: true,
      opportunity: updated,
    });
  } catch (error: any) {
    console.error('Error updating opportunity:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await prisma.rateSavingsOpportunity.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Opportunity deleted',
    });
  } catch (error: any) {
    console.error('Error deleting opportunity:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
