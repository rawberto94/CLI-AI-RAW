import { AutoBreadcrumbs } from '@/components/navigation/AutoBreadcrumbs';
import { RateCardsDisabled } from '@/components/rate-cards/RateCardsDisabled';
import { isRateCardsEnabled } from '@/lib/features';

export default function RateCardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isRateCardsEnabled()) {
    return <RateCardsDisabled />;
  }

  return (
    <div className="min-h-screen">
      <div className="px-6 pt-4">
        <AutoBreadcrumbs />
      </div>
      {children}
    </div>
  );
}
