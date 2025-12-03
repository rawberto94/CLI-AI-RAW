/**
 * Taxonomy Category Detail API
 * GET /api/taxonomy/[id] - Get single category
 * PUT /api/taxonomy/[id] - Update category
 * DELETE /api/taxonomy/[id] - Delete category
 * 
 * ✅ Multi-tenant isolation
 * ✅ Cascade updates for path changes
 * ✅ Safe deletion with child handling
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TaxonomyCategoryUpdate {
  name?: string;
  description?: string;
  parentId?: string | null;
  keywords?: string[];
  aiClassificationPrompt?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Update paths for all children when parent path changes
 */
async function updateChildPaths(
  tenantId: string,
  categoryId: string,
  newPath: string,
  newLevel: number
): Promise<void> {
  const children = await prisma.taxonomyCategory.findMany({
    where: { tenantId, parentId: categoryId },
  });

  for (const child of children) {
    const childPath = `${newPath}/${child.name}`;
    const childLevel = newLevel + 1;

    await prisma.taxonomyCategory.update({
      where: { id: child.id },
      data: { path: childPath, level: childLevel },
    });

    // Recursively update grandchildren
    await updateChildPaths(tenantId, child.id, childPath, childLevel);
  }
}

// ============================================================================
// GET - Get single category
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const tenantId = request.headers.get("x-tenant-id") || "demo";
    const { searchParams } = new URL(request.url);
    const includeChildren = searchParams.get("includeChildren") === "true";

    const category = await prisma.taxonomyCategory.findFirst({
      where: { id, tenantId },
      include: includeChildren
        ? {
            children: {
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            },
            parent: true,
          }
        : { parent: true },
    });

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: "Category not found",
        },
        { status: 404 }
      );
    }

    // Get contract count for this category
    const contractCount = await prisma.contract.count({
      where: { tenantId, category: category.name },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...category,
        keywords: category.keywords || [],
        contractCount,
      },
    });
  } catch (error) {
    console.error("Error fetching taxonomy category:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch taxonomy category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update category
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const tenantId = request.headers.get("x-tenant-id") || "demo";
    const body: TaxonomyCategoryUpdate = await request.json();

    // Find existing category
    const existing = await prisma.taxonomyCategory.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Category not found",
        },
        { status: 404 }
      );
    }

    // Check for duplicate name if changing
    if (body.name && body.name !== existing.name) {
      const duplicate = await prisma.taxonomyCategory.findFirst({
        where: {
          tenantId,
          name: body.name,
          parentId: body.parentId ?? existing.parentId,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: "Duplicate category",
            details: `A category named "${body.name}" already exists at this level`,
          },
          { status: 409 }
        );
      }
    }

    // Calculate new path if name or parent changed
    let newPath = existing.path;
    let newLevel = existing.level;

    const nameChanged = body.name && body.name !== existing.name;
    const parentChanged =
      body.parentId !== undefined && body.parentId !== existing.parentId;

    if (nameChanged || parentChanged) {
      const effectiveName = body.name || existing.name;
      const effectiveParentId =
        body.parentId !== undefined ? body.parentId : existing.parentId;

      if (!effectiveParentId) {
        newPath = `/${effectiveName}`;
        newLevel = 0;
      } else {
        // Prevent circular reference
        if (effectiveParentId === id) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid parent",
              details: "Category cannot be its own parent",
            },
            { status: 400 }
          );
        }

        const parent = await prisma.taxonomyCategory.findFirst({
          where: { id: effectiveParentId, tenantId },
        });

        if (!parent) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid parent",
              details: "Parent category not found",
            },
            { status: 400 }
          );
        }

        // Check if parent is a descendant (would create circular reference)
        if (parent.path.startsWith(existing.path + "/")) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid parent",
              details: "Cannot move category under its own descendant",
            },
            { status: 400 }
          );
        }

        newPath = `${parent.path}/${effectiveName}`;
        newLevel = parent.level + 1;
      }
    }

    // Update category
    const updated = await prisma.taxonomyCategory.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
        ...(body.keywords && { keywords: body.keywords }),
        ...(body.aiClassificationPrompt !== undefined && {
          aiClassificationPrompt: body.aiClassificationPrompt,
        }),
        ...(body.color && { color: body.color }),
        ...(body.icon && { icon: body.icon }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        path: newPath,
        level: newLevel,
        updatedAt: new Date(),
      },
    });

    // Update child paths if path changed
    if (newPath !== existing.path) {
      await updateChildPaths(tenantId, id, newPath, newLevel);
    }

    // Update contracts if category name changed
    if (nameChanged) {
      await prisma.contract.updateMany({
        where: { tenantId, category: existing.name },
        data: { category: body.name },
      });
    }

    console.log("✅ Taxonomy category updated:", {
      id,
      name: updated.name,
      pathChanged: newPath !== existing.path,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        keywords: updated.keywords || [],
      },
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Error updating taxonomy category:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update taxonomy category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete category
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const tenantId = request.headers.get("x-tenant-id") || "demo";
    const { searchParams } = new URL(request.url);
    
    // Options for deletion
    const deleteChildren = searchParams.get("deleteChildren") === "true";
    const reassignTo = searchParams.get("reassignTo"); // Category ID to reassign children to

    // Find existing category
    const existing = await prisma.taxonomyCategory.findFirst({
      where: { id, tenantId },
      include: {
        children: { select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Category not found",
        },
        { status: 404 }
      );
    }

    // Check for children
    const hasChildren = existing.children.length > 0;

    if (hasChildren && !deleteChildren && !reassignTo) {
      return NextResponse.json(
        {
          success: false,
          error: "Category has children",
          details:
            "Use deleteChildren=true to delete all children, or reassignTo=[id] to move children to another category",
          childCount: existing.children.length,
        },
        { status: 400 }
      );
    }

    // Handle children
    if (hasChildren) {
      if (deleteChildren) {
        // Recursively delete all children
        const deleteChildrenRecursively = async (parentId: string) => {
          const children = await prisma.taxonomyCategory.findMany({
            where: { tenantId, parentId },
            select: { id: true },
          });

          for (const child of children) {
            await deleteChildrenRecursively(child.id);
            await prisma.taxonomyCategory.delete({ where: { id: child.id } });
          }
        };

        await deleteChildrenRecursively(id);
      } else if (reassignTo) {
        // Verify target category exists
        const target = await prisma.taxonomyCategory.findFirst({
          where: { id: reassignTo, tenantId },
        });

        if (!target) {
          return NextResponse.json(
            {
              success: false,
              error: "Reassign target not found",
            },
            { status: 400 }
          );
        }

        // Move children to new parent
        for (const child of existing.children) {
          const childCat = await prisma.taxonomyCategory.findUnique({
            where: { id: child.id },
          });

          if (childCat) {
            const newPath = `${target.path}/${childCat.name}`;
            await prisma.taxonomyCategory.update({
              where: { id: child.id },
              data: {
                parentId: reassignTo,
                path: newPath,
                level: target.level + 1,
              },
            });

            // Update grandchildren paths
            await updateChildPaths(tenantId, child.id, newPath, target.level + 1);
          }
        }
      }
    }

    // Clear category from contracts
    await prisma.contract.updateMany({
      where: { tenantId, category: existing.name },
      data: { category: null },
    });

    // Delete the category
    await prisma.taxonomyCategory.delete({ where: { id } });

    console.log("✅ Taxonomy category deleted:", {
      id,
      name: existing.name,
      childrenHandled: hasChildren ? (deleteChildren ? "deleted" : "reassigned") : "none",
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
      childrenHandled: hasChildren
        ? deleteChildren
          ? "deleted"
          : "reassigned"
        : "none",
    });
  } catch (error) {
    console.error("Error deleting taxonomy category:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete taxonomy category",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
    },
  });
}
