import Link from 'next/link'

export function RateCardsDisabled() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">This module is not enabled</h1>
        <p className="mt-2 text-sm text-slate-600">
          Rate Cards is hidden for this workspace. Contract values and analysis are unchanged.
        </p>
        <Link
          href="/contracts"
          className="mt-6 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          Go to Contracts
        </Link>
      </div>
    </div>
  )
}
