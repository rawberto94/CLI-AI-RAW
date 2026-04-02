import { AutoBreadcrumbs } from '@/components/navigation/AutoBreadcrumbs';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 pt-6">
        <AutoBreadcrumbs homeHref="/dashboard" homeLabel="Dashboard" />
      </div>
      <div className="max-w-[1600px] mx-auto">
        {children}
      </div>
    </div>
  );
}
