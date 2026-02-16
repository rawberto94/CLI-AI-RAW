/**
 * Auth Layout - Separate layout for authentication pages
 * No sidebar, no navigation - just the auth form with branding
 * Enhanced with modern gradient backgrounds
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/30">
      {children}
    </div>
  );
}
