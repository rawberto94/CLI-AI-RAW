/**
 * Rate Benchmarking Data Hook
 * 
 * Automatically switches between mock and real data based on data mode
 * Fetches real data from analytical database when in "real" mode
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDataMode } from './useDataMode';
import type { RoleRate, SupplierData } from '@/lib/use-cases/enhanced-rate-benchmarking-data';
import { 
  mockSuppliers, 
  mockRoleRates 
} from '@/lib/use-cases/enhanced-rate-benchmarking-data';

interface RateBenchmarkingData {
  suppliers: SupplierData[];
  roleRates: RoleRate[];
  loading: boolean;
  error: string | null;
  dataSource: 'mock' | 'real';
  lastUpdated: Date | null;
}

export function useRateBenchmarkingData(tenantId: string = 'demo') {
  const { mode } = useDataMode();
  const [realData, setRealData] = useState<{
    suppliers: SupplierData[];
    roleRates: RoleRate[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch real data when in real mode
  useEffect(() => {
    if (mode === 'real') {
      fetchRealData();
    }
  }, [mode, tenantId]);

  const fetchRealData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from analytical database
      const response = await fetch(`/api/analytics/intelligence/rate-benchmarking?tenantId=${tenantId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rate benchmarking data');
      }

      const data = await response.json();

      // Transform API data to match our interface
      const transformedData = transformApiDataToRoleRates(data);
      
      setRealData(transformedData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching real rate data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load real data');
      
      // Fallback to mock data on error
      setRealData(null);
    } finally {
      setLoading(false);
    }
  };

  // Return appropriate data based on mode
  const data: RateBenchmarkingData = useMemo(() => {
    if (mode === 'mock') {
      return {
        suppliers: mockSuppliers,
        roleRates: mockRoleRates,
        loading: false,
        error: null,
        dataSource: 'mock',
        lastUpdated: new Date(), // Mock data is always "fresh"
      };
    }

    // Real mode
    if (loading) {
      return {
        suppliers: [],
        roleRates: [],
        loading: true,
        error: null,
        dataSource: 'real',
        lastUpdated: null,
      };
    }

    if (error || !realData) {
      // Fallback to mock data if real data fails
      return {
        suppliers: mockSuppliers,
        roleRates: mockRoleRates,
        loading: false,
        error,
        dataSource: 'mock', // Indicate we fell back to mock
        lastUpdated: null,
      };
    }

    return {
      suppliers: realData.suppliers,
      roleRates: realData.roleRates,
      loading: false,
      error: null,
      dataSource: 'real',
      lastUpdated,
    };
  }, [mode, realData, loading, error, lastUpdated]);

  return {
    ...data,
    refresh: fetchRealData,
  };
}

/**
 * Transform API data from analytical database to RoleRate format
 */
function transformApiDataToRoleRates(apiData: any): {
  suppliers: SupplierData[];
  roleRates: RoleRate[];
} {
  const suppliers: SupplierData[] = [];
  const roleRates: RoleRate[] = [];

  // Extract suppliers from contracts
  const supplierMap = new Map<string, SupplierData>();

  if (apiData.benchmarks && Array.isArray(apiData.benchmarks)) {
    apiData.benchmarks.forEach((benchmark: any, index: number) => {
      // Extract supplier info
      const supplierName = benchmark.supplier || benchmark.supplierName || 'Unknown Supplier';
      
      if (!supplierMap.has(supplierName)) {
        supplierMap.set(supplierName, {
          id: `supplier-${index}`,
          name: supplierName,
          tier: inferSupplierTier(supplierName),
          serviceLines: ['IT Consulting'], // Default, could be enhanced
          geographies: [inferGeography(benchmark.region || benchmark.location)],
          reputation: 4.0,
          dataQuality: {
            sampleSize: benchmark.sampleSize || 1,
            lastUpdated: new Date(benchmark.lastUpdated || Date.now()),
            confidence: benchmark.confidence || 0.8,
          },
        });
      }

      // Create role rate entry
      if (benchmark.rates && Array.isArray(benchmark.rates)) {
        benchmark.rates.forEach((rate: any, rateIndex: number) => {
          const roleRate: RoleRate = {
            id: `rate-${index}-${rateIndex}`,
            role: rate.role || rate.roleName || 'Consultant',
            standardizedRole: standardizeRole(rate.role || rate.roleName),
            level: inferSeniorityLevel(rate.role || rate.roleName),
            serviceLine: 'IT Consulting',
            geography: inferGeography(rate.region || rate.location || benchmark.region),
            supplierId: `supplier-${index}`,
            hourlyRate: rate.hourlyRate || rate.rate || 0,
            dailyRate: (rate.hourlyRate || rate.rate || 0) * 8,
            effectiveDate: new Date(rate.effectiveDate || benchmark.effectiveDate || Date.now()),
            chainIQBenchmark: rate.benchmark || rate.marketMedian || rate.hourlyRate || 0,
            chainIQPercentile: {
              p25: rate.p25 || (rate.hourlyRate || 0) * 0.85,
              p75: rate.p75 || (rate.hourlyRate || 0) * 1.15,
              p90: rate.p90 || (rate.hourlyRate || 0) * 1.30,
            },
            industryAverage: rate.industryAverage || rate.hourlyRate || 0,
            fteCount: rate.fteCount || 1,
            totalAnnualCost: (rate.hourlyRate || 0) * 2080 * (rate.fteCount || 1),
            contractDate: new Date(benchmark.contractDate || Date.now()),
            lastUpdated: new Date(benchmark.lastUpdated || Date.now()),
            supplierName,
            locationPremium: rate.locationPremium || 1.0,
            skillsPremium: rate.skillsPremium || 1.0,
          };

          roleRates.push(roleRate);
        });
      }
    });
  }

  return {
    suppliers: Array.from(supplierMap.values()),
    roleRates,
  };
}

/**
 * Helper functions to infer data from contract information
 */
function inferSupplierTier(supplierName: string): 'Big 4' | 'Tier 2' | 'Boutique' | 'Offshore' {
  const name = supplierName.toLowerCase();
  
  if (name.includes('deloitte') || name.includes('pwc') || name.includes('ey') || name.includes('kpmg')) {
    return 'Big 4';
  }
  
  if (name.includes('accenture') || name.includes('capgemini') || name.includes('cognizant')) {
    return 'Tier 2';
  }
  
  if (name.includes('offshore') || name.includes('india') || name.includes('philippines')) {
    return 'Offshore';
  }
  
  return 'Boutique';
}

function inferGeography(location?: string): 'North America - Onshore' | 'EMEA - Western Europe' | 'APAC - India' {
  if (!location) return 'North America - Onshore';
  
  const loc = location.toLowerCase();
  
  if (loc.includes('india') || loc.includes('bangalore') || loc.includes('mumbai')) {
    return 'APAC - India';
  }
  
  if (loc.includes('europe') || loc.includes('uk') || loc.includes('germany') || loc.includes('france')) {
    return 'EMEA - Western Europe';
  }
  
  return 'North America - Onshore';
}

function standardizeRole(role: string): string {
  const roleLower = role.toLowerCase();
  
  if (roleLower.includes('developer') || roleLower.includes('engineer')) {
    return 'Software Engineer';
  }
  
  if (roleLower.includes('consultant')) {
    return 'Consultant';
  }
  
  if (roleLower.includes('analyst')) {
    return 'Business Analyst';
  }
  
  if (roleLower.includes('manager') || roleLower.includes('lead')) {
    return 'Project Manager';
  }
  
  if (roleLower.includes('architect')) {
    return 'Solution Architect';
  }
  
  return role;
}

function inferSeniorityLevel(role: string): 'Junior' | 'Mid' | 'Senior' | 'Principal' | 'Partner' {
  const roleLower = role.toLowerCase();
  
  if (roleLower.includes('junior') || roleLower.includes('jr')) {
    return 'Junior';
  }
  
  if (roleLower.includes('senior') || roleLower.includes('sr')) {
    return 'Senior';
  }
  
  if (roleLower.includes('principal') || roleLower.includes('staff')) {
    return 'Principal';
  }
  
  if (roleLower.includes('partner') || roleLower.includes('director')) {
    return 'Partner';
  }
  
  return 'Mid';
}
