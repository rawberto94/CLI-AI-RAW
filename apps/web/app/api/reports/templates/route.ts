import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Get all saved report templates
    // In production, store these in a database table
    const templates = [
      {
        id: "1",
        name: "Monthly Supplier Performance",
        type: "supplier",
        fields: ["supplier_name", "active_contracts", "total_spend", "avg_performance"],
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Rate Card Analysis",
        type: "rate-card",
        fields: ["role_name", "seniority", "avg_rate", "rate_count"],
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const template = await request.json();

    // In production, save to database
    // For now, just return success
    return NextResponse.json({
      success: true,
      template: {
        id: Date.now().toString(),
        ...template,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error saving template:", error);
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 }
    );
  }
}
