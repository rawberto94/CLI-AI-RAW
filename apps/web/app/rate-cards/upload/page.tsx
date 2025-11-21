import { Metadata } from 'next';
import { RateCardUploadClientPage } from './client-page';

export const metadata: Metadata = {
  title: 'Upload Rate Cards | Procurement Intelligence',
  description: 'Bulk import rate cards via CSV upload',
};

export default function RateCardUploadPage() {
  return <RateCardUploadClientPage />;
}
