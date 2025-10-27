'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function RateCardBreadcrumbs() {
  const pathname = usePathname();

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', href: '/' },
    ];

    if (pathname.startsWith('/rate-cards')) {
      breadcrumbs.push({ label: 'Rate Cards', href: '/rate-cards/dashboard' });

      if (pathname.includes('/dashboard')) {
        breadcrumbs.push({ label: 'Dashboard', href: '/rate-cards/dashboard' });
      } else if (pathname.includes('/entries')) {
        breadcrumbs.push({ label: 'Entries', href: '/rate-cards/entries' });
      } else if (pathname.includes('/upload')) {
        breadcrumbs.push({ label: 'Upload', href: '/rate-cards/upload' });
      } else if (pathname.includes('/benchmarking')) {
        breadcrumbs.push({ label: 'Benchmarking', href: '/rate-cards/benchmarking' });
      } else if (pathname.includes('/suppliers')) {
        breadcrumbs.push({ label: 'Suppliers', href: '/rate-cards/suppliers' });
        
        // Check for supplier detail page
        const supplierIdMatch = pathname.match(/\/suppliers\/([^/]+)/);
        if (supplierIdMatch && !pathname.endsWith('/suppliers')) {
          breadcrumbs.push({ label: 'Supplier Details', href: pathname });
        }
      } else if (pathname.includes('/opportunities')) {
        breadcrumbs.push({ label: 'Opportunities', href: '/rate-cards/opportunities' });
        
        // Check for opportunity detail page
        const oppIdMatch = pathname.match(/\/opportunities\/([^/]+)/);
        if (oppIdMatch && !pathname.endsWith('/opportunities')) {
          breadcrumbs.push({ label: 'Opportunity Details', href: pathname });
        }
      } else if (pathname.includes('/market-intelligence')) {
        breadcrumbs.push({ label: 'Market Intelligence', href: '/rate-cards/market-intelligence' });
      } else if (pathname.includes('/baselines')) {
        breadcrumbs.push({ label: 'Baselines', href: '/rate-cards/baselines' });
        
        if (pathname.includes('/import')) {
          breadcrumbs.push({ label: 'Import', href: '/rate-cards/baselines/import' });
        }
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-2" />}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors"
            >
              {index === 0 ? (
                <Home className="h-4 w-4" />
              ) : (
                crumb.label
              )}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
