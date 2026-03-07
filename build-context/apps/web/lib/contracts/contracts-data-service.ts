/**
 * Contracts Data Service
 * Handles fetching real contract data from the API
 */

// Unwrap potentially wrapped AI values
function unwrapValue<T>(val: T | { value: T; source?: string } | undefined): T | undefined {
  if (val && typeof val === 'object' && 'value' in val) {
    return (val as { value: T }).value;
  }
  return val as T;
}

export interface Contract {
  id: string;
  filename: string;
  originalName?: string;
  status: "pending" | "processing" | "completed" | "failed";
  uploadDate: string;
  processedAt?: string;
  fileSize: number;
  contractType?: string;
  totalValue?: number;
  currency?: string;
  riskScore?: number;
  complianceScore?: number;
  parties?: string[];
  effectiveDate?: string;
  expirationDate?: string;
  error?: string;
  processing?: {
    status: string;
    progress: number;
    currentStage: string;
  };
  extractedData?: any;
}

export interface ContractsListResponse {
  success: boolean;
  contracts: Contract[];
  total: number;
  error?: string;
}

export interface ContractDetailResponse {
  success: boolean;
  contract: Contract;
  error?: string;
}

/**
 * Fetch all contracts from the API
 * Note: This is now only used from client components
 */
export async function fetchContracts(): Promise<Contract[]> {
  try {
    const response = await fetch("/api/contracts/list", {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data: ContractsListResponse = await response.json();

    if (!data.success) {
      return [];
    }

    return data.contracts || [];
  } catch {
    return [];
  }
}

/**
 * Fetch a single contract by ID
 * Note: This is now only used from client components
 */
export async function fetchContract(id: string): Promise<Contract | null> {
  try {
    const response = await fetch(`/api/contracts/${id}`, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: ContractDetailResponse = await response.json();

    if (!data.success) {
      return null;
    }

    return data.contract || null;
  } catch {
    return null;
  }
}

/**
 * Format contract status for display
 */
export function getStatusDisplay(status: string): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  color: string;
} {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        variant: "default",
        color: "green",
      };
    case "processing":
      return {
        label: "Processing",
        variant: "secondary",
        color: "blue",
      };
    case "failed":
      return {
        label: "Failed",
        variant: "destructive",
        color: "red",
      };
    case "pending":
      return {
        label: "Pending",
        variant: "outline",
        color: "yellow",
      };
    default:
      return {
        label: status,
        variant: "outline",
        color: "gray",
      };
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format currency for display
 */
export function formatCurrency(
  amount: number,
  currency: string = "CHF"
): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Format date and time for display
 */
export function formatDateTime(dateString: string): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Get risk level from score
 */
export function getRiskLevel(score: number): {
  level: string;
  color: string;
} {
  if (score >= 80) return { level: "High", color: "red" };
  if (score >= 50) return { level: "Medium", color: "yellow" };
  return { level: "Low", color: "green" };
}

/**
 * Get compliance level from score
 */
export function getComplianceLevel(score: number): {
  level: string;
  color: string;
} {
  if (score >= 90) return { level: "Excellent", color: "green" };
  if (score >= 70) return { level: "Good", color: "blue" };
  if (score >= 50) return { level: "Fair", color: "yellow" };
  return { level: "Poor", color: "red" };
}

/**
 * Extract summary data from contract
 */
export function getContractSummary(contract: Contract) {
  const extractedData = contract.extractedData || {};

  return {
    parties: unwrapValue(extractedData.metadata?.parties) || contract.parties || [],
    totalValue: unwrapValue(extractedData.financial?.totalValue) || contract.totalValue,
    currency: unwrapValue(extractedData.financial?.currency) || contract.currency || "USD",
    effectiveDate:
      unwrapValue(extractedData.metadata?.effectiveDate) || contract.effectiveDate,
    expirationDate:
      unwrapValue(extractedData.metadata?.expirationDate) || contract.expirationDate,
    contractType: unwrapValue(extractedData.metadata?.contractType) || contract.contractType,
    riskScore: unwrapValue(extractedData.risk?.overallScore) || contract.riskScore,
    complianceScore:
      unwrapValue(extractedData.compliance?.score) || contract.complianceScore,
  };
}
