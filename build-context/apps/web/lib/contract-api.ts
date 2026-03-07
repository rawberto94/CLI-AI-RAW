/**
 * Contract API utilities with ID validation
 */
import { ContractIdValidator } from './contract-id-validator';
import { API_BASE_URL } from './config';
import { tenantHeaders } from './tenant';

export interface ContractApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ContractApi {
  /**
   * Safely fetch contract data with ID validation
   */
  static async fetchContract(contractId: string): Promise<ContractApiResponse> {
    const validation = ContractIdValidator.validateId(contractId);
    
    if (!validation.isValid) {
      // Try to fix common issues
      const fixedId = ContractIdValidator.fixCommonIssues(contractId);
      contractId = fixedId;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/contracts/${contractId}`, {
        headers: tenantHeaders()
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch contract: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Safely fetch contract artifacts with ID validation
   */
  static async fetchArtifact(contractId: string, artifactType: string): Promise<ContractApiResponse> {
    const validation = ContractIdValidator.validateId(contractId);
    
    if (!validation.isValid) {
      const fixedId = ContractIdValidator.fixCommonIssues(contractId);
      contractId = fixedId;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/contracts/${contractId}/artifacts/${artifactType}`, {
        headers: tenantHeaders()
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch artifact: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all contracts with error handling
   */
  static async fetchContracts(): Promise<ContractApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contracts`, {
        headers: tenantHeaders()
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch contracts: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      const contracts = Array.isArray(data) ? data : (data?.items || []);
      
      // Validate and fix any invalid contract IDs
      const validatedContracts = contracts.map((contract: { id?: string; [key: string]: unknown }) => {
        if (contract.id) {
          const validation = ContractIdValidator.validateId(contract.id);
          if (!validation.isValid) {
            const fixedId = ContractIdValidator.fixCommonIssues(contract.id);
            return { ...contract, id: fixedId };
          }
        }
        return contract;
      });

      return { success: true, data: validatedContracts };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}