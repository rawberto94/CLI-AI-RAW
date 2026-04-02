import Link from 'next/link';
import type { ReactNode } from 'react';

/* ──────────────────────────────────────────────
   Shared Marketing Header
   ────────────────────────────────────────────── */
function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="ConTigo home">
          <img src="/logo-icon.svg" alt="ConTigo" width={32} height={32} className="object-contain" />
          <span className="text-xl tracking-tight">
            <span className="font-bold text-violet-700 dark:text-violet-400">con</span>
            <span className="font-light text-slate-900 dark:text-white">tigo</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {[
            { label: 'Features', href: '/features' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'About', href: '/about' },
            { label: 'Security', href: '/security' },
            { label: 'Contact', href: '/contact' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:block"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────
   Shared Marketing Footer
   ────────────────────────────────────────────── */
function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5" aria-label="ConTigo home">
              <img src="/logo-icon.svg" alt="ConTigo" width={28} height={28} className="object-contain" />
              <span className="text-lg tracking-tight">
                <span className="font-bold text-violet-700 dark:text-violet-400">con</span>
                <span className="font-light text-slate-900 dark:text-white">tigo</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              AI-powered contract lifecycle management for modern enterprises. Secure, intelligent, and built in Switzerland.
            </p>
          </div>

          {/* Links */}
          {[
            {
              title: 'Product',
              links: [
                { label: 'Features', href: '/features' },
                { label: 'Pricing', href: '/pricing' },
                { label: 'Security', href: '/security' },
              ],
            },
            {
              title: 'Company',
              links: [
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ],
            },
            {
              title: 'Legal',
              links: [
                { label: 'Terms', href: '/terms' },
                { label: 'Privacy', href: '/privacy' },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{col.title}</h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 dark:border-slate-800 md:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {currentYear} ConTigo GmbH. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Swiss-made &middot; Zurich, Switzerland
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   Marketing Layout — Shared header, footer, <main>
   Fixes: B1 (shared layout), E1 (skip link target), B2 (unified design)
   ────────────────────────────────────────────── */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <MarketingHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
