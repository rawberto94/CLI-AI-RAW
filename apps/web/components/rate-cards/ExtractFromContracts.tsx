'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';

interface Contract {
  id: string;
  fileName: string;
  supplierName?: string;
  startDate?: string;
}

interface ExtractFromContractsProps {
  onSuccess?: () => void;
  tenantId?: string;
}

export function ExtractFromContracts({ onSuccess, tenantId = 'demo' }: ExtractFromContractsProps) {
  const [open, setOpen] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { success, error, warning } = useToast();

  useEffect(() => {
    if (open) {
      loadContracts();
    }
  }, [open]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockContracts: Contract[] = [
        {
          id: '1',
          fileName: 'SOW-2025-IT-Services.pdf',
          supplierName: 'TechConsult Inc',
          startDate: '2025-01-01'
        },
        {
          id: '2',
          fileName: 'MSA-Cloud-Services-2025.pdf',
          supplierName: 'Cloud Solutions Ltd',
          startDate: '2025-01-15'
        },
        {
          id: '3',
          fileName: 'Consulting-Agreement-2025.pdf',
          supplierName: 'Business Intelligence Corp',
          startDate: '2025-02-01'
        }
      ];
      setContracts(mockContracts);
    } catch (err) {
      error('Error', 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!selectedContract) return;

    setExtracting(true);
    setResult(null);

    try {
      const response = await fetch('/api/rate-cards/import/from-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedContract,
          tenantId,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success && data.imported > 0) {
        success('Success', `Extracted ${data.imported} rate card entries from contract`);
        onSuccess?.();
        setTimeout(() => {
          setOpen(false);
          setSelectedContract('');
          setResult(null);
        }, 2000);
      } else if (data.imported === 0) {
        warning('No Rate Cards Found', 'No rate card artifacts found in this contract');
      } else {
        warning('Partial Success', `Extracted ${data.imported} entries, ${data.errors} failed`);
      }
    } catch (err) {
      error('Error', 'Failed to extract rate cards from contract');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Extract from Contracts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Extract Rate Cards from Contracts</DialogTitle>
          <DialogDescription>
            Select a contract to extract rate card information from its artifacts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contract Selection */}
          <div className="space-y-2">
            <Label htmlFor="contract">Select Contract</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : contracts.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No contracts with rate card artifacts found
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a contract..." />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{contract.fileName}</span>
                        {contract.supplierName && (
                          <span className="text-xs text-gray-500">
                            {contract.supplierName}
                            {contract.startDate && ` • ${new Date(contract.startDate).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Info Box */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              This will extract rate card information from the contract's artifacts and create 
              rate card entries in the repository. Duplicate entries will be skipped.
            </AlertDescription>
          </Alert>

          {/* Result */}
          {result && (
            <div className="space-y-3">
              {result.success && result.imported > 0 ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <p className="font-medium">Successfully extracted rate cards!</p>
                    <div className="mt-2 text-sm space-y-1">
                      <p>• Imported: {result.imported} rate card entries</p>
                      {result.errors > 0 && <p>• Errors: {result.errors} entries failed</p>}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Extraction completed with issues</p>
                    <div className="mt-2 text-sm space-y-1">
                      <p>• Imported: {result.imported || 0} rate card entries</p>
                      <p>• Errors: {result.errors || 0} entries failed</p>
                    </div>
                    {result.data?.errors?.length > 0 && (
                      <div className="mt-3 max-h-32 overflow-y-auto">
                        <p className="font-medium mb-1">Error details:</p>
                        {result.data.errors.slice(0, 3).map((err: any, idx: number) => (
                          <p key={idx} className="text-xs">• {err.error}</p>
                        ))}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={extracting}
          >
            Close
          </Button>
          <Button 
            onClick={handleExtract}
            disabled={!selectedContract || extracting || loading}
          >
            {extracting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Extract Rate Cards
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
