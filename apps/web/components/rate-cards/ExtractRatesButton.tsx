'use client';

/**
 * Extract Rates Button
 * Triggers rate card extraction from a contract
 */

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { getTenantId } from '@/lib/tenant';
import { FileText, Loader2 } from 'lucide-react';
import { RateCardExtractionModal } from './RateCardExtractionModal';
import toast from 'react-hot-toast';

interface ExtractRatesButtonProps {
  contractId: string;
  contractName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function ExtractRatesButton({
  contractId,
  contractName,
  variant = 'default',
  size = 'default',
}: ExtractRatesButtonProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const { data: session } = useSession();

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      const response = await fetch(`/api/rate-cards/extract/${contractId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to extract rate cards');
      }

      const result = await response.json();

      if (result.extraction.rates.length === 0) {
        toast.error('No rate cards found in this contract');
        return;
      }

      setExtractionResult(result);
      setIsModalOpen(true);
      toast.success(`Found ${result.extraction.rates.length} rate cards`);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to extract rate cards'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async (rates: any[]) => {
    try {
      const response = await fetch(`/api/rate-cards/extract/${contractId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
          'x-user-id': session?.user?.id || 'anonymous',
        },
        body: JSON.stringify({
          rates,
          supplierInfo: extractionResult.extraction.supplierInfo,
          contractContext: extractionResult.extraction.contractContext,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save rate cards');
      }

      const result = await response.json();
      toast.success(result.message);
      
      // Refresh the page or update the UI
      window.location.reload();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save rate cards'
      );
      throw error;
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleExtract}
        disabled={isExtracting}
      >
        {isExtracting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Extracting...
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 mr-2" />
            Extract Rates
          </>
        )}
      </Button>

      {extractionResult && (
        <RateCardExtractionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          contractId={contractId}
          contractName={contractName}
          extraction={extractionResult.extraction}
          validation={extractionResult.validation}
          onSave={handleSave}
        />
      )}
    </>
  );
}
