import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock variables for templates
const mockVariables = [
  { 
    id: 'v1', 
    name: 'client_name', 
    displayName: 'Client Name', 
    type: 'text', 
    required: true,
    placeholder: 'Enter client name',
    helpText: 'Full legal name of the client organization',
  },
  { 
    id: 'v2', 
    name: 'supplier_name', 
    displayName: 'Supplier Name', 
    type: 'text', 
    required: true,
    placeholder: 'Enter supplier name',
    helpText: 'Full legal name of the supplier organization',
  },
  { 
    id: 'v3', 
    name: 'effective_date', 
    displayName: 'Effective Date', 
    type: 'date', 
    required: true,
    helpText: 'Date when the contract becomes effective',
  },
  { 
    id: 'v4', 
    name: 'contract_value', 
    displayName: 'Contract Value', 
    type: 'currency', 
    required: true,
    helpText: 'Total contract value including all fees',
  },
  { 
    id: 'v5', 
    name: 'payment_terms', 
    displayName: 'Payment Terms (Days)', 
    type: 'number', 
    required: true, 
    defaultValue: 30,
    helpText: 'Number of days for payment terms (e.g., Net 30)',
  },
  { 
    id: 'v6', 
    name: 'governing_law', 
    displayName: 'Governing Law', 
    type: 'select', 
    required: true, 
    options: [
      { value: 'swiss', label: 'Swiss Law' },
      { value: 'english', label: 'English Law' },
      { value: 'german', label: 'German Law' },
      { value: 'new_york', label: 'New York Law' },
      { value: 'california', label: 'California Law' },
      { value: 'delaware', label: 'Delaware Law' },
    ],
    helpText: 'Jurisdiction whose laws govern this contract',
  },
  { 
    id: 'v7', 
    name: 'notice_period', 
    displayName: 'Notice Period (Days)', 
    type: 'number', 
    required: false, 
    defaultValue: 30,
    helpText: 'Number of days notice required for termination',
  },
  { 
    id: 'v8', 
    name: 'warranty_period', 
    displayName: 'Warranty Period (Months)', 
    type: 'number', 
    required: false, 
    defaultValue: 12,
    helpText: 'Duration of warranty in months',
  },
  { 
    id: 'v9', 
    name: 'liability_cap', 
    displayName: 'Liability Cap', 
    type: 'currency', 
    required: false,
    helpText: 'Maximum liability amount for either party',
  },
  { 
    id: 'v10', 
    name: 'renewal_terms', 
    displayName: 'Automatic Renewal', 
    type: 'select', 
    required: false, 
    options: [
      { value: 'none', label: 'No automatic renewal' },
      { value: '1_year', label: 'Auto-renew for 1 year' },
      { value: '2_year', label: 'Auto-renew for 2 years' },
      { value: 'same_term', label: 'Auto-renew for same term' },
    ],
    helpText: 'Automatic renewal terms after initial period',
  },
];

// GET /api/templates/[id]/variables - Get template variables
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;

    // Try to get variables from database
    try {
      const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        select: { 
          id: true, 
          metadata: true,
        },
      });

      if (template) {
        const metadata = template.metadata as Record<string, unknown> | null;
        const variables = metadata?.variables as unknown[];
        
        if (variables && Array.isArray(variables) && variables.length > 0) {
          return NextResponse.json({ 
            variables,
            source: 'database'
          });
        }
      }
    } catch {
      // Database lookup failed, fallback to mock
    }

    // Return mock variables
    return NextResponse.json({ 
      variables: mockVariables,
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch template variables' },
      { status: 500 }
    );
  }
}

// PUT /api/templates/[id]/variables - Update template variables
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const body = await request.json();
    const { variables } = body;

    // Try to update in database
    try {
      const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        select: { metadata: true },
      });

      if (template) {
        const currentMetadata = (template.metadata as Record<string, unknown>) || {};
        
        await prisma.contractTemplate.update({
          where: { id: templateId },
          data: {
            metadata: {
              ...currentMetadata,
              variables,
            },
          },
        });

        return NextResponse.json({ 
          variables,
          source: 'database'
        });
      }
    } catch {
      // Database update failed, fallback to mock
    }

    return NextResponse.json({ 
      variables,
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update template variables' },
      { status: 500 }
    );
  }
}

// POST /api/templates/[id]/variables - Add a new variable
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const body = await request.json();
    const { name, displayName, type, required = false, options, defaultValue, helpText } = body;

    const newVariable = {
      id: `v-${Date.now()}`,
      name,
      displayName,
      type,
      required,
      options,
      defaultValue,
      helpText,
    };

    // Try to add to database
    try {
      const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        select: { metadata: true },
      });

      if (template) {
        const currentMetadata = (template.metadata as Record<string, unknown>) || {};
        const existingVariables = (currentMetadata.variables as Record<string, unknown>[]) || [];
        
        await prisma.contractTemplate.update({
          where: { id: templateId },
          data: {
            metadata: JSON.parse(JSON.stringify({
              ...currentMetadata,
              variables: [...existingVariables, newVariable],
            })),
          },
        });

        return NextResponse.json({ 
          variable: newVariable,
          source: 'database'
        });
      }
    } catch {
      // Database update failed, fallback to mock
    }

    return NextResponse.json({ 
      variable: newVariable,
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to add template variable' },
      { status: 500 }
    );
  }
}
