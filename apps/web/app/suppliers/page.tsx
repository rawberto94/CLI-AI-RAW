import SuppliersClient from './SuppliersClient';

export const metadata = {
  title: 'Vendor Management | ConTigo',
  description: 'Manage supplier profiles, risk assessments, and contracts',
};

export default function SuppliersPage() {
  return <SuppliersClient />;
}
