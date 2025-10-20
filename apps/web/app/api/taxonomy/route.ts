/**
 * Taxonomy Management API
 * Manages categories, tags, and metadata fields
 */

import { NextRequest, NextResponse } from "next/server";
import { taxonomyService } from "@/lib/data-orchestration";

/**
 * GET /api/taxonomy - Get taxonomy data (categories, tags, fields)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || "demo";
    const type = searchParams.get("type"); // categories, tags, fields, analytics

    switch (type) {
      case "categories":
        const categoriesResult = await taxonomyService.getTaxonomyCategories(tenantId);
        if (!categoriesResult.success) {
          return NextResponse.json({
            success: false,
            error: categoriesResult.error?.message || "Failed to get categories"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: categoriesResult.data
        });

      case "tags":
        const categoryId = searchParams.get("categoryId");
        const tagsResult = await taxonomyService.getTags(tenantId, categoryId || undefined);
        if (!tagsResult.success) {
          return NextResponse.json({
            success: false,
            error: tagsResult.error?.message || "Failed to get tags"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: tagsResult.data
        });

      case "fields":
        const fieldsResult = await taxonomyService.getMetadataFields(tenantId);
        if (!fieldsResult.success) {
          return NextResponse.json({
            success: false,
            error: fieldsResult.error?.message || "Failed to get metadata fields"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: fieldsResult.data
        });

      case "analytics":
        const analyticsResult = await taxonomyService.getTaxonomyAnalytics(tenantId);
        if (!analyticsResult.success) {
          return NextResponse.json({
            success: false,
            error: analyticsResult.error?.message || "Failed to get analytics"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: analyticsResult.data
        });

      default:
        // Get all taxonomy data
        const [categories, tags, fields] = await Promise.all([
          taxonomyService.getTaxonomyCategories(tenantId),
          taxonomyService.getTags(tenantId),
          taxonomyService.getMetadataFields(tenantId)
        ]);

        return NextResponse.json({
          success: true,
          data: {
            categories: categories.success ? categories.data : [],
            tags: tags.success ? tags.data : [],
            fields: fields.success ? fields.data : []
          }
        });
    }

  } catch (error) {
    console.error("Get taxonomy error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get taxonomy data",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * POST /api/taxonomy - Create taxonomy items
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = body.tenantId || "demo";
    const type = body.type; // category, tag, field

    switch (type) {
      case "category":
        const categoryResult = await taxonomyService.upsertTaxonomyCategory(tenantId, body.data);
        if (!categoryResult.success) {
          return NextResponse.json({
            success: false,
            error: categoryResult.error?.message || "Failed to create category"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: categoryResult.data,
          message: "Category created successfully"
        });

      case "tag":
        const tagResult = await taxonomyService.upsertTag(tenantId, body.data);
        if (!tagResult.success) {
          return NextResponse.json({
            success: false,
            error: tagResult.error?.message || "Failed to create tag"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: tagResult.data,
          message: "Tag created successfully"
        });

      case "field":
        const fieldResult = await taxonomyService.upsertMetadataField(tenantId, body.data);
        if (!fieldResult.success) {
          return NextResponse.json({
            success: false,
            error: fieldResult.error?.message || "Failed to create field"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: fieldResult.data,
          message: "Metadata field created successfully"
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid type parameter"
        }, { status: 400 });
    }

  } catch (error) {
    console.error("Create taxonomy item error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to create taxonomy item",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * PUT /api/taxonomy - Update taxonomy items
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = body.tenantId || "demo";
    const type = body.type; // category, tag, field

    switch (type) {
      case "category":
        const categoryResult = await taxonomyService.upsertTaxonomyCategory(tenantId, body.data);
        if (!categoryResult.success) {
          return NextResponse.json({
            success: false,
            error: categoryResult.error?.message || "Failed to update category"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: categoryResult.data,
          message: "Category updated successfully"
        });

      case "tag":
        const tagResult = await taxonomyService.upsertTag(tenantId, body.data);
        if (!tagResult.success) {
          return NextResponse.json({
            success: false,
            error: tagResult.error?.message || "Failed to update tag"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: tagResult.data,
          message: "Tag updated successfully"
        });

      case "field":
        const fieldResult = await taxonomyService.upsertMetadataField(tenantId, body.data);
        if (!fieldResult.success) {
          return NextResponse.json({
            success: false,
            error: fieldResult.error?.message || "Failed to update field"
          }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          data: fieldResult.data,
          message: "Metadata field updated successfully"
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid type parameter"
        }, { status: 400 });
    }

  } catch (error) {
    console.error("Update taxonomy item error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to update taxonomy item",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
      "Access-Control-Max-Age": "86400"
    }
  });
}