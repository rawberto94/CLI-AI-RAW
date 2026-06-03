import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ConTigo — AI-Powered Contract Lifecycle Management',
  description:
    'Transform contract management with Swiss-engineered AI. Extract insights, track obligations, and manage your entire contract portfolio in one intelligent platform.',
  openGraph: {
    title: 'ConTigo — AI-Powered Contract Lifecycle Management',
    description:
      'Transform contract management with Swiss-engineered AI. Extract insights, track obligations, and manage your entire contract portfolio.',
    type: 'website',
  },
};

// Force async to trigger root loading.tsx Suspense boundary
export default async function LandingPage() {
  await new Promise(r => setTimeout(r, 10));

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-100 via-slate-50 to-slate-50 dark:from-violet-950/40 dark:via-slate-900 dark:to-slate-900" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white font-bold text-sm">
            C
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-white">ConTigo</span>
        </div>
        <Link
          href="/auth/signin"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 transition-colors"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
            <span className="mr-2 flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Demo environment ready
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
            Contract intelligence,{' '}
            <span className="text-violet-600">Swiss-engineered</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
            AI-powered contract lifecycle management for rail, manufacturing, and enterprise.
            Extract insights, track obligations, and manage your portfolio with precision.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 transition-all"
            >
              Launch Demo
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              stadler@contigodemo.com / Stadler123!
            </span>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
          {[
            {
              title: 'Smart Analysis',
              desc: 'AI extracts key terms, risks, and obligations from any contract format.',
            },
            {
              title: 'Obligation Tracking',
              desc: 'Never miss a deadline. Automated alerts for renewals, payments, and deliverables.',
            },
            {
              title: 'Risk Radar',
              desc: 'Proactive identification of contractual risks and compliance gaps.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white/60 p-6 text-left backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/50">
                <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
        ConTigo Demo Environment · 15 contracts loaded for Stadler Rail
      </footer>
    </main>
  );
}
