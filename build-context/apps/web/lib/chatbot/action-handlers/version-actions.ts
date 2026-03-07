/**
 * Version Actions Handler
 * 
 * Handles all contract versioning operations from chatbot commands:
 * - show_version_history: Display version history for a contract
 * - compare_versions: Compare two versions of a contract
 * - create_version: Create a new version (snapshot)
 * - revert_to_version: Activate a previous version
 * - upload_new_version: Guide user to upload new version
 */

import { DetectedIntent, ChatContext, ActionResponse } from '../types';
import getDb from '@/lib/prisma';

// ============ TYPES ============

interface VersionInfo {
  id: string;
  versionNumber: number;
  uploadedBy: string | null;
  uploadedAt: string;
  isActive: boolean;
  summary: string | null;
  changes: Record<string, unknown> | null;
  fileUrl: string | null;
}

interface VersionComparison {
  versionA: VersionInfo;
  versionB: VersionInfo;
  differences: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

// ============ MAIN HANDLER ============

export async function handleVersionAction(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;
  const contractId = entities.contractId || context.currentContractId;

  if (!contractId && action !== 'upload_new_version') {
    return {
      success: false,
      message: "I need to know which contract you're referring to. Could you specify the contract name or ID?",
      error: 'missing_contract_id'
    };
  }

  switch (action) {
    case 'show_version_history':
      return await showVersionHistory(contractId!, context);
    
    case 'compare_versions':
      return await compareVersions(
        contractId!,
        entities.compareVersionA,
        entities.compareVersionB,
        context
      );
    
    case 'create_version':
      return await createVersionSnapshot(
        contractId!,
        entities.versionSummary || 'Snapshot created via chat',
        context
      );
    
    case 'revert_to_version':
      return await revertToVersion(
        contractId!,
        entities.versionNumber || entities.targetVersionId,
        context
      );
    
    case 'upload_new_version':
      return handleUploadGuidance(contractId);
    
    case 'export_version_history':
      return await exportVersionHistory(contractId!, context);
    
    default:
      return {
        success: false,
        message: `I don't recognize the version action "${action}". I can help you view version history, compare versions, create snapshots, or revert to previous versions.`,
        error: 'unknown_action'
      };
  }
}

// ============ ACTION IMPLEMENTATIONS ============

async function showVersionHistory(
  contractId: string,
  context: ChatContext
): Promise<ActionResponse> {
  try {
    const db = await getDb();
    
    // Get contract info
    const contract = await db.contract.findFirst({
      where: { id: contractId, tenantId: context.tenantId },
      select: { id: true, fileName: true, status: true }
    });

    if (!contract) {
      return {
        success: false,
        message: "I couldn't find that contract. Please check the contract ID.",
        error: 'contract_not_found'
      };
    }

    // Get versions
    const versions = await db.contractVersion.findMany({
      where: { contractId, tenantId: context.tenantId },
      orderBy: { versionNumber: 'desc' },
      include: {
        uploadedByUser: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (versions.length === 0) {
      return {
        success: true,
        message: `📋 **${contract.fileName}**\n\nThis contract doesn't have any version history yet. When you make changes or upload new documents, versions will be tracked automatically.\n\n💡 **Tip:** You can create a snapshot anytime by saying "create a version snapshot for this contract".`,
        data: { contract, versions: [] }
      };
    }

    // Format version history
    const versionList = versions.map(v => {
      const userName = v.uploadedByUser 
        ? `${v.uploadedByUser.firstName || ''} ${v.uploadedByUser.lastName || ''}`.trim()
        : v.uploadedBy || 'System';
      const date = new Date(v.uploadedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const activeMarker = v.isActive ? ' ✅ *Current*' : '';
      const summary = v.summary ? `: ${v.summary}` : '';
      
      return `• **v${v.versionNumber}**${activeMarker} - ${date} by ${userName}${summary}`;
    }).join('\n');

    const currentVersion = versions.find(v => v.isActive);

    return {
      success: true,
      message: `📋 **Version History: ${contract.fileName}**\n\n${versionList}\n\n---\n**Current Version:** v${currentVersion?.versionNumber || versions[0]?.versionNumber || 1}\n**Total Versions:** ${versions.length}\n\n💡 Say "compare version X with version Y" to see differences, or "revert to version X" to roll back.`,
      data: { 
        contract, 
        versions: versions.map(v => ({
          id: v.id,
          versionNumber: v.versionNumber,
          uploadedAt: v.uploadedAt,
          isActive: v.isActive,
          summary: v.summary
        })),
        currentVersion: currentVersion?.versionNumber
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: "I encountered an error fetching the version history. Please try again.",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function compareVersions(
  contractId: string,
  versionA?: number,
  versionB?: number,
  context?: ChatContext
): Promise<ActionResponse> {
  try {
    const db = await getDb();
    
    // Get all versions
    const versions = await db.contractVersion.findMany({
      where: { contractId, tenantId: context?.tenantId },
      orderBy: { versionNumber: 'asc' }
    });

    if (versions.length < 2) {
      return {
        success: false,
        message: "This contract needs at least 2 versions to compare. Currently there's only one version.",
        error: 'insufficient_versions'
      };
    }

    // Default to comparing current with previous
    const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
    const verA = versionA || sortedVersions[1]?.versionNumber || 1;
    const verB = versionB || sortedVersions[0]?.versionNumber || 2;

    const versionAData = versions.find(v => v.versionNumber === verA);
    const versionBData = versions.find(v => v.versionNumber === verB);

    if (!versionAData || !versionBData) {
      return {
        success: false,
        message: `I couldn't find version ${!versionAData ? verA : verB}. Available versions: ${versions.map(v => v.versionNumber).join(', ')}.`,
        error: 'version_not_found'
      };
    }

    // Compare changes
    const changesA = (versionAData.changes as Record<string, unknown>) || {};
    const changesB = (versionBData.changes as Record<string, unknown>) || {};
    
    const differences: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    
    // Get all unique keys from both versions' changes
    const allKeys = new Set([...Object.keys(changesA), ...Object.keys(changesB)]);
    
    for (const key of allKeys) {
      const valA = changesA[key];
      const valB = changesB[key];
      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        differences.push({
          field: key,
          oldValue: valA,
          newValue: valB
        });
      }
    }

    // Format comparison
    let diffSummary: string;
    if (differences.length === 0) {
      diffSummary = "No recorded field changes between these versions.";
    } else {
      diffSummary = differences.map(d => {
        const formatValue = (v: unknown) => {
          if (v === null || v === undefined) return '(empty)';
          if (typeof v === 'object') return JSON.stringify(v);
          return String(v);
        };
        return `• **${d.field}**: ${formatValue(d.oldValue)} → ${formatValue(d.newValue)}`;
      }).join('\n');
    }

    return {
      success: true,
      message: `🔄 **Comparing Version ${verA} ↔ Version ${verB}**\n\n**Version ${verA}:** ${versionAData.summary || 'No summary'}\n**Version ${verB}:** ${versionBData.summary || 'No summary'}\n\n**Changes:**\n${diffSummary}\n\n💡 Say "revert to version ${verA}" to roll back to the earlier version.`,
      data: {
        versionA: { number: verA, summary: versionAData.summary },
        versionB: { number: verB, summary: versionBData.summary },
        differences,
        comparisonUrl: `/contracts/${contractId}/versions/compare?v1=${verA}&v2=${verB}`
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: "I encountered an error comparing versions. Please try again.",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function createVersionSnapshot(
  contractId: string,
  summary: string,
  context: ChatContext
): Promise<ActionResponse> {
  try {
    const db = await getDb();
    
    // Get current contract state
    const contract = await db.contract.findFirst({
      where: { id: contractId, tenantId: context.tenantId },
      select: {
        id: true,
        fileName: true,
        status: true,
        totalValue: true,
        expirationDate: true,
        effectiveDate: true,
        supplierName: true
      }
    });

    if (!contract) {
      return {
        success: false,
        message: "I couldn't find that contract.",
        error: 'contract_not_found'
      };
    }

    // Get latest version number
    const latestVersion = await db.contractVersion.findFirst({
      where: { contractId, tenantId: context.tenantId },
      orderBy: { versionNumber: 'desc' }
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Capture current state as changes
    const currentState: Record<string, unknown> = {
      status: contract.status,
      totalValue: contract.totalValue?.toString() || null,
      expirationDate: contract.expirationDate?.toISOString() || null,
      effectiveDate: contract.effectiveDate?.toISOString() || null,
      supplierName: contract.supplierName
    };

    // Deactivate current version
    if (latestVersion) {
      await db.contractVersion.update({
        where: { id: latestVersion.id },
        data: { isActive: false, supersededAt: new Date() }
      });
    }

    // Create new version
    const newVersion = await db.contractVersion.create({
      data: {
        contractId,
        tenantId: context.tenantId,
        versionNumber: newVersionNumber,
        parentVersionId: latestVersion?.id || null,
        summary,
        changes: JSON.parse(JSON.stringify(currentState)),
        uploadedBy: context.userId || 'Chatbot',
        isActive: true,
        uploadedAt: new Date()
      }
    });

    return {
      success: true,
      message: `✅ **Version ${newVersionNumber} Created**\n\n📋 **${contract.fileName}**\n\n${summary}\n\nThis snapshot captures the current state of the contract. You can revert to this version anytime by saying "revert to version ${newVersionNumber}".`,
      data: {
        version: {
          id: newVersion.id,
          versionNumber: newVersion.versionNumber,
          summary: newVersion.summary,
          createdAt: newVersion.uploadedAt
        }
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: "I encountered an error creating the version snapshot. Please try again.",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function revertToVersion(
  contractId: string,
  versionIdentifier: number | string | undefined,
  context: ChatContext
): Promise<ActionResponse> {
  if (!versionIdentifier) {
    return {
      success: false,
      message: "Which version would you like to revert to? Please specify a version number (e.g., \"revert to version 2\").",
      error: 'missing_version'
    };
  }

  try {
    const db = await getDb();
    
    // Find target version
    const targetVersion = await db.contractVersion.findFirst({
      where: {
        contractId,
        tenantId: context.tenantId,
        ...(typeof versionIdentifier === 'number' 
          ? { versionNumber: versionIdentifier }
          : { id: String(versionIdentifier) }
        )
      }
    });

    if (!targetVersion) {
      return {
        success: false,
        message: `I couldn't find version ${versionIdentifier}. Try "show version history" to see available versions.`,
        error: 'version_not_found'
      };
    }

    if (targetVersion.isActive) {
      return {
        success: true,
        message: `Version ${targetVersion.versionNumber} is already the active version. No changes needed.`,
        data: { version: targetVersion }
      };
    }

    // Deactivate all versions
    await db.contractVersion.updateMany({
      where: { contractId, tenantId: context.tenantId },
      data: { isActive: false }
    });

    // Activate target version
    await db.contractVersion.update({
      where: { id: targetVersion.id },
      data: { isActive: true }
    });

    return {
      success: true,
      message: `⏪ **Reverted to Version ${targetVersion.versionNumber}**\n\n${targetVersion.summary || 'No summary available'}\n\nThe contract now reflects the state from ${new Date(targetVersion.uploadedAt).toLocaleDateString()}.\n\n⚠️ Note: This change affects the version history only. To restore the contract document, you may need to re-upload the file from this version.`,
      data: {
        revertedTo: {
          id: targetVersion.id,
          versionNumber: targetVersion.versionNumber,
          summary: targetVersion.summary
        }
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: "I encountered an error reverting to that version. Please try again.",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function handleUploadGuidance(contractId?: string): ActionResponse {
  const contractPath = contractId ? `/contracts/${contractId}` : '/contracts';
  
  return {
    success: true,
    message: `📤 **Upload a New Version**\n\nTo upload a new version of a contract:\n\n1. Go to the contract detail page\n2. Click the **"Upload New Version"** button in the version panel\n3. Select your updated document\n4. Add a summary of changes\n\nAlternatively, you can:\n• Use **Quick Upload** from the contracts page header\n• Navigate to **/contracts/upload** for advanced upload options\n\n💡 Each upload automatically creates a new version, preserving the full history.`,
    data: {
      navigation: {
        contractPath,
        uploadPath: '/contracts/upload',
        quickUploadAvailable: true
      }
    }
  };
}

async function exportVersionHistory(
  contractId: string,
  context: ChatContext
): Promise<ActionResponse> {
  try {
    const db = await getDb();
    
    const contract = await db.contract.findFirst({
      where: { id: contractId, tenantId: context.tenantId },
      select: {
        id: true,
        fileName: true,
        contractTitle: true,
        status: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            uploadedBy: true,
            uploadedAt: true,
            isActive: true,
            summary: true,
            changes: true,
          }
        }
      }
    });

    if (!contract) {
      return {
        success: false,
        message: "I couldn't find that contract. Please make sure you're viewing a valid contract.",
        error: 'contract_not_found'
      };
    }

    if (!contract.versions || contract.versions.length === 0) {
      return {
        success: false,
        message: `📋 **${contract.fileName || contract.contractTitle}** has no version history to export yet.\n\nVersion history is created when you upload new versions or create snapshots.`,
        error: 'no_versions'
      };
    }

    // Format version history for export
    const exportData = {
      contractId: contract.id,
      contractName: contract.fileName || contract.contractTitle,
      status: contract.status,
      exportedAt: new Date().toISOString(),
      totalVersions: contract.versions.length,
      versions: contract.versions.map(v => ({
        versionNumber: v.versionNumber,
        isActive: v.isActive,
        summary: v.summary || 'No summary provided',
        uploadedBy: v.uploadedBy || 'System',
        uploadedAt: v.uploadedAt,
        changesCount: v.changes ? Object.keys(v.changes as object).length : 0,
      }))
    };

    // Generate CSV format
    const csvHeader = 'Version,Status,Summary,Uploaded By,Uploaded At,Changes Count';
    const csvRows = contract.versions.map(v => 
      `${v.versionNumber},${v.isActive ? 'Current' : 'Previous'},"${(v.summary || 'No summary').replace(/"/g, '""')}",${v.uploadedBy || 'System'},${new Date(v.uploadedAt).toISOString()},${v.changes ? Object.keys(v.changes as object).length : 0}`
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');

    // Generate markdown summary
    const versionList = contract.versions.slice(0, 5).map(v => {
      const date = new Date(v.uploadedAt).toLocaleDateString();
      const status = v.isActive ? '✓ Current' : '';
      return `• **v${v.versionNumber}** ${status} - ${date} by ${v.uploadedBy || 'System'}`;
    }).join('\n');

    const moreText = contract.versions.length > 5 
      ? `\n\n_...and ${contract.versions.length - 5} more versions_` 
      : '';

    return {
      success: true,
      message: `📊 **Version History Export**\n\n📋 **${contract.fileName || contract.contractTitle}**\n\n**${contract.versions.length}** versions found:\n\n${versionList}${moreText}\n\n---\n\n**Export Options:**\n• 📋 Copy the data below to your clipboard\n• 💾 Download as CSV for spreadsheet analysis\n• 📄 Use the version comparison page for detailed diffs`,
      data: {
        exportData,
        csvContent,
        downloadFilename: `${(contract.fileName || 'contract').replace(/[^a-z0-9]/gi, '_')}_version_history.csv`,
        quickActions: [
          {
            label: '📋 Copy CSV',
            action: `copy:${csvContent}`,
            icon: 'copy'
          },
          {
            label: '📊 View All Versions',
            action: `navigate:/contracts/${contractId}?tab=activity`,
            icon: 'view'
          },
          {
            label: '🔍 Compare Versions',
            action: `navigate:/contracts/${contractId}/versions/compare`,
            icon: 'compare'
          }
        ]
      }
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: "I encountered an error exporting the version history. Please try again.",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============ EXPORTS ============

export const versionActionPatterns = [
  // Version history patterns
  { pattern: /(?:show|view|list|get)\s+(?:version|revision)\s*(?:history|log)?/i, action: 'show_version_history' as const },
  { pattern: /(?:what|which)\s+versions?\s+(?:are\s+there|exist|do\s+we\s+have)/i, action: 'show_version_history' as const },
  { pattern: /version\s+history/i, action: 'show_version_history' as const },
  
  // Compare versions patterns
  { pattern: /compare\s+version\s*(\d+)\s+(?:with|to|and|vs)\s+(?:version\s*)?(\d+)/i, action: 'compare_versions' as const },
  { pattern: /diff(?:erence)?\s+between\s+version/i, action: 'compare_versions' as const },
  { pattern: /what\s+changed\s+(?:between|from)\s+version/i, action: 'compare_versions' as const },
  
  // Create version patterns
  { pattern: /(?:create|make|save)\s+(?:a\s+)?(?:version|snapshot|backup)/i, action: 'create_version' as const },
  { pattern: /snapshot\s+(?:the\s+)?(?:current\s+)?(?:contract|state)/i, action: 'create_version' as const },
  
  // Revert patterns
  { pattern: /revert\s+(?:to\s+)?version\s*(\d+)/i, action: 'revert_to_version' as const },
  { pattern: /(?:roll\s*back|restore)\s+(?:to\s+)?version\s*(\d+)/i, action: 'revert_to_version' as const },
  { pattern: /go\s+back\s+to\s+version\s*(\d+)/i, action: 'revert_to_version' as const },
  
  // Upload new version patterns
  { pattern: /upload\s+(?:a\s+)?new\s+version/i, action: 'upload_new_version' as const },
  { pattern: /(?:add|attach)\s+(?:a\s+)?(?:new|updated)\s+(?:document|file|version)/i, action: 'upload_new_version' as const },
  
  // Export version history patterns
  { pattern: /export\s+(?:version|revision)\s*(?:history|log)?/i, action: 'export_version_history' as const },
  { pattern: /download\s+(?:version|revision)\s*(?:history|log)/i, action: 'export_version_history' as const },
  { pattern: /(?:get|save)\s+version\s+history\s+(?:as|to)\s+(?:csv|file|excel)/i, action: 'export_version_history' as const },
];

export default handleVersionAction;
