'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumbs() {
  const pathname = usePathname();

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', href: '/' }
    ];

    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      
      // Convert path to readable label
      let label = path
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Special cases for better labels
      if (path === 'analytics') {
        label = 'Analytics';
      } else if (path === 'procurement') {
        label = 'Procurement Intelligence';
      } else if (path === 'suppliers') {
        label = 'Supplier Analytics';
      } else if (path === 'negotiation') {
        label = 'Negotiation Preparation';
      } else if (path === 'savings') {
        label = 'Savings Pipeline';
      } else if (path === 'renewals') {
        label = 'Renewal Radar';
      } else if (path === 'rate-intelligence') {
        label = 'Rate Intelligence';
      }

      breadcrumbs.push({
        label,
        href: currentPath
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={`${crumb.label}-${index}`}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4" />
          )}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              {index === 0 && <Home className="h-4 w-4" />}
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
