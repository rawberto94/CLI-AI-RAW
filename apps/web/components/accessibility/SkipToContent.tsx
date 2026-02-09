'use client';

import { usePathname as _usePathname } from 'next/navigation';

/**
 * Skip to main content link for keyboard navigation accessibility.
 * 
 * This component should be placed at the very beginning of your layout,
 * before any navigation elements. It allows keyboard users to skip
 * repetitive navigation and go directly to the main content.
 * 
 * Usage in layout.tsx:
 * ```tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SkipToContent />
 *         <Navigation />
 *         <main id="main-content">
 *           {children}
 *         </main>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 * 
 * IMPORTANT: Make sure your main content area has `id="main-content"`
 */
export function SkipToContent({
  targetId = 'main-content',
  label = 'Skip to main content',
}: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-to-content sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 transition-all"
    >
      {label}
    </a>
  );
}

/**
 * Multiple skip links for complex layouts with multiple landmark regions.
 */
export function SkipLinks({
  links,
}: {
  links: Array<{ targetId: string; label: string }>;
}) {
  return (
    <nav
      aria-label="Skip links"
      className="skip-links-container"
    >
      <ul className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:top-0 focus-within:left-0 focus-within:z-[9999] focus-within:flex focus-within:flex-col focus-within:gap-2 focus-within:p-4 focus-within:bg-white focus-within:dark:bg-slate-900 focus-within:shadow-lg focus-within:rounded-br-lg">
        {links.map((link) => (
          <li key={link.targetId}>
            <a
              href={`#${link.targetId}`}
              className="block px-4 py-2 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-md focus:bg-violet-100 dark:focus:bg-violet-900/40 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Wrapper component that adds main content id for skip link targeting.
 */
export function MainContent({
  id = 'main-content',
  children,
  className = '',
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      id={id}
      className={className}
      tabIndex={-1}
      role="main"
      aria-label="Main content"
    >
      {children}
    </main>
  );
}

/**
 * Focus skip link component that automatically scrolls to target.
 */
export function FocusSkipLink({
  targetId,
  label,
}: {
  targetId: string;
  label: string;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
    >
      {label}
    </a>
  );
}

export default SkipToContent;
