import { Suspense } from 'react';
import VisualWorkflowBuilder from '@/components/workflows/VisualWorkflowBuilder';

export const metadata = { title: 'Workflow Designer — ConTigo' };

export default function WorkflowDesignerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <div className="container mx-auto p-6">
        <VisualWorkflowBuilder />
      </div>
    </Suspense>
  );
}
