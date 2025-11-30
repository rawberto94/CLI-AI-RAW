'use client';

import React from 'react';
import { VersionCompare, DocumentVersion } from '@/components/contracts/VersionCompare';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, History } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

// Mock versions data
const mockVersions: DocumentVersion[] = [
  {
    id: 'v1',
    version: 'v1.0',
    author: { id: '1', name: 'John Smith' },
    timestamp: new Date('2024-01-15'),
    changes: 0,
    label: 'Initial Draft',
    content: `This Master Services Agreement (the "Agreement") is entered into as of the Effective Date by and between the parties identified below.

1. Term and Termination

The initial term of this Agreement shall be one (1) year from the Effective Date. Either party may terminate this Agreement upon thirty (30) days prior written notice.

2. License Grant

Subject to the terms of this Agreement, Provider grants Client a non-exclusive license to use the Services during the Term.

3. Confidentiality

Each party agrees to maintain in confidence all Confidential Information disclosed by the other party.`,
  },
  {
    id: 'v2',
    version: 'v1.1',
    author: { id: '2', name: 'Sarah Johnson' },
    timestamp: new Date('2024-01-20'),
    changes: 5,
    content: `This Master Services Agreement (the "Agreement") is entered into as of the Effective Date by and between the parties identified below. This Agreement governs all services.

1. Term and Termination

The initial term of this Agreement shall be two (2) years from the Effective Date. Either party may terminate this Agreement upon sixty (60) days prior written notice to the other party.

2. License Grant

Subject to the terms of this Agreement, Provider grants Client an exclusive license to use the Services during the Term.

3. Confidentiality

Each party agrees to maintain in confidence all Confidential Information disclosed by the other party and to use such information only for purposes of this Agreement.`,
  },
  {
    id: 'v3',
    version: 'v1.2',
    author: { id: '1', name: 'John Smith' },
    timestamp: new Date('2024-01-25'),
    changes: 8,
    label: 'Legal Review',
    content: `This Master Services Agreement (the "Agreement") is entered into as of the Effective Date by and between the parties identified below. This Agreement governs all services provided.

1. Term and Termination

The initial term of this Agreement shall be two (2) years from the Effective Date. Either party may terminate this Agreement upon sixty (60) days prior written notice to the other party. Termination shall not affect any accrued rights.

2. License Grant

Subject to the terms and conditions of this Agreement, Provider grants Client an exclusive license to use the Services during the Term.

3. Confidentiality

Each party agrees to maintain in confidence all Confidential Information disclosed by the other party and to use such information only for purposes of this Agreement.

4. Limitation of Liability

IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT.`,
  },
  {
    id: 'v4',
    version: 'v2.0',
    author: { id: '3', name: 'Legal Team' },
    timestamp: new Date('2024-02-01'),
    changes: 12,
    label: 'Final',
    content: `This Master Services Agreement (the "Agreement") is entered into as of the Effective Date by and between the parties identified below. This Agreement shall govern all services provided under this arrangement.

1. Term and Termination

The initial term of this Agreement shall be three (3) years from the Effective Date. Either party may terminate this Agreement upon ninety (90) days prior written notice to the other party. Termination shall not affect any accrued rights or obligations.

2. License Grant

Subject to the terms and conditions of this Agreement, Provider grants Client an exclusive, worldwide license to use the Services during the Term.

3. Confidentiality

Each party agrees to maintain in strict confidence all Confidential Information disclosed by the other party and to use such information only for purposes of this Agreement. This obligation survives termination.

4. Limitation of Liability

IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT, REGARDLESS OF THE FORM OF ACTION OR THE BASIS OF THE CLAIM.

5. Governing Law

This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.`,
  },
];

export default function VersionsPage({ params }: { params: { id: string } }) {
  const handleAcceptVersion = (versionId: string) => {
    const version = mockVersions.find((v) => v.id === versionId);
    toast.success(`Version ${version?.version || versionId} accepted`, {
      description: 'The selected version has been set as the current version.',
    });
  };

  const handleMergeVersions = (leftId: string, rightId: string) => {
    toast.info('Merge initiated', {
      description: 'Opening merge editor to combine versions...',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/contracts/${params.id}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Contract
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-500" />
                  Master Services Agreement - Version History
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {mockVersions.length} versions
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version Compare */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <VersionCompare
          documentId={params.id}
          versions={mockVersions}
          onAcceptVersion={handleAcceptVersion}
          onMergeVersions={handleMergeVersions}
          className="h-[calc(100vh-180px)]"
        />
      </div>
    </div>
  );
}
