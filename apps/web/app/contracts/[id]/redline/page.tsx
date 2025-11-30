'use client';

import React, { useState } from 'react';
import { RedlineEditor } from '@/components/contracts/RedlineEditor';
import { PageBreadcrumb } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Clock, Users, Shield } from 'lucide-react';
import Link from 'next/link';

// Mock document content
const mockContent = `This Master Services Agreement (the "Agreement") is entered into as of the Effective Date by and between the parties identified below. This Agreement shall govern all services provided.

1. Term and Termination

The initial term of this Agreement shall be one (1) year from the Effective Date. Either party may terminate this Agreement upon thirty (30) days prior written notice to the other party.

2. License Grant

Subject to the terms and conditions of this Agreement, Provider grants Client an exclusive license to use the Services during the Term.

3. Confidentiality

Each party agrees to maintain in confidence all Confidential Information disclosed by the other party and to use such information only for purposes of this Agreement.

4. Limitation of Liability

IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT.`;

export default function RedlinePage({ params }: { params: { id: string } }) {
  const currentUser = {
    id: 'current-user',
    name: 'You',
    avatar: undefined,
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
                  <FileText className="w-5 h-5 text-blue-500" />
                  Master Services Agreement - Redline
                </h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last edited 2 hours ago
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    3 collaborators
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    In Review
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <RedlineEditor
          documentId={params.id}
          initialContent={mockContent}
          currentUser={currentUser}
          onSave={(content, changes) => {
            console.log('Saving:', { content, changes });
          }}
          className="h-[calc(100vh-180px)]"
        />
      </div>
    </div>
  );
}
