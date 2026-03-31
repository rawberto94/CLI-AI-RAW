import { prisma } from '@/lib/prisma';

export type GovernanceWorkflowStep = {
  name?: string | null;
  assignedRole?: string | null;
  assignedUser?: string | null;
  config?: unknown;
};

export type ContractGovernanceScope = {
  tenantId: string;
  contractType?: string | null;
  totalValue?: unknown;
  currency?: string | null;
};

export type PreApprovalGateSummary = {
  id: string;
  name: string;
  description: string | null;
  gateType: string;
  gateOrder: number;
  approvalMode: string;
  requiredApprovers: string[];
  appliesToTypes: string[];
  appliesToValuesAbove: number | null;
  currency: string | null;
};

export type PreApprovalGateEvaluation = {
  applicableGates: PreApprovalGateSummary[];
  unmetGates: PreApprovalGateSummary[];
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry): entry is string => entry.length > 0);
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function matchesToken(candidate: string, target: string): boolean {
  return candidate === target || candidate.includes(target) || target.includes(candidate);
}

function extractStepTokens(step: GovernanceWorkflowStep): string[] {
  const config = step.config && typeof step.config === 'object'
    ? (step.config as Record<string, unknown>)
    : null;

  return [
    step.name,
    step.assignedRole,
    step.assignedUser,
    ...(config ? normalizeStringArray(config.approvers) : []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeToken);
}

function summarizeGate(gate: {
  id: string;
  name: string;
  description: string | null;
  gateType: string;
  gateOrder: number;
  approvalMode: string;
  requiredApprovers: unknown;
  appliesToTypes: unknown;
  appliesToValuesAbove: unknown;
  currency: string | null;
}): PreApprovalGateSummary {
  return {
    id: gate.id,
    name: gate.name,
    description: gate.description,
    gateType: gate.gateType,
    gateOrder: gate.gateOrder,
    approvalMode: gate.approvalMode,
    requiredApprovers: normalizeStringArray(gate.requiredApprovers),
    appliesToTypes: normalizeStringArray(gate.appliesToTypes),
    appliesToValuesAbove: toNumber(gate.appliesToValuesAbove),
    currency: gate.currency,
  };
}

function gateAppliesToContract(
  gate: PreApprovalGateSummary,
  contract: ContractGovernanceScope
): boolean {
  const contractType = normalizeToken(contract.contractType || '');
  if (gate.appliesToTypes.length > 0) {
    if (!contractType) return false;

    const matchesType = gate.appliesToTypes
      .map(normalizeToken)
      .some((gateType) => matchesToken(contractType, gateType));

    if (!matchesType) {
      return false;
    }
  }

  if (gate.appliesToValuesAbove != null) {
    const contractValue = toNumber(contract.totalValue);
    if (contractValue == null || contractValue < gate.appliesToValuesAbove) {
      return false;
    }

    const gateCurrency = (gate.currency || '').trim().toUpperCase();
    const contractCurrency = (contract.currency || '').trim().toUpperCase();
    if (gateCurrency && contractCurrency && gateCurrency !== contractCurrency) {
      return false;
    }
  }

  return true;
}

function gateIsRepresentedInWorkflow(
  gate: PreApprovalGateSummary,
  steps: GovernanceWorkflowStep[]
): boolean {
  if (steps.length === 0) {
    return false;
  }

  const stepTokens = steps.flatMap(extractStepTokens);
  if (stepTokens.length === 0) {
    return false;
  }

  if (gate.requiredApprovers.length > 0) {
    const approverMatches = gate.requiredApprovers.filter((approver) => {
      const normalizedApprover = normalizeToken(approver);
      return stepTokens.some((token) => matchesToken(token, normalizedApprover));
    });

    if ((gate.approvalMode || 'ALL').toUpperCase() === 'ANY') {
      return approverMatches.length > 0;
    }

    return approverMatches.length === gate.requiredApprovers.length;
  }

  const normalizedGateName = normalizeToken(gate.name);
  return stepTokens.some((token) => matchesToken(token, normalizedGateName));
}

export async function evaluateContractPreApprovalGates(
  contract: ContractGovernanceScope,
  steps: GovernanceWorkflowStep[]
): Promise<PreApprovalGateEvaluation> {
  const activeGates = await prisma.preApprovalGate.findMany({
    where: {
      tenantId: contract.tenantId,
      isActive: true,
    },
    orderBy: [
      { gateOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  const applicableGates = activeGates
    .map(summarizeGate)
    .filter((gate) => gateAppliesToContract(gate, contract));

  const unmetGates = applicableGates.filter((gate) => !gateIsRepresentedInWorkflow(gate, steps));

  return {
    applicableGates,
    unmetGates,
  };
}

export function formatUnmetPreApprovalGates(gates: PreApprovalGateSummary[]): string {
  return gates
    .map((gate) => {
      if (gate.requiredApprovers.length > 0) {
        return `${gate.name} (${gate.requiredApprovers.join(', ')})`;
      }

      return gate.name;
    })
    .join('; ');
}
