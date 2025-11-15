import { Metadata } from 'next';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { CSVImportModal } from '@/components/rate-cards/CSVImportModal';

export const metadata: Metadata = {
  title: 'Upload Rate Cards | Procurement Intelligence',
  description: 'Bulk import rate cards via CSV upload',
};

export default function RateCardUploadPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div>
        <h1 className="text-3xl font-bold">Upload Rate Cards</h1>
        <p className="text-muted-foreground">
          Bulk import rate cards using CSV file upload
        </p>
      </div>

      <div className="max-w-4xl">
        <CSVImportModal isOpen={true} onClose={() => {}} />
      </div>
    </div>
  );
}
