/**
 * Shared visual tokens for Contigo Labs.
 * Prefer these over ad-hoc gradients / font-black / heavy shadows.
 */

export const labsUi = {
  page: 'min-h-screen bg-slate-50/80 dark:bg-slate-950',
  shell: 'max-w-[1600px] mx-auto px-5 sm:px-8 lg:px-10',

  card: 'overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
  cardHeader: 'border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60',
  cardTitle: 'flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-slate-50',
  cardDescription: 'mt-0.5 text-xs font-medium text-slate-500',
  cardContent: 'p-4 sm:p-5',

  iconWell: 'flex h-9 w-9 items-center justify-center rounded-lg border',
  iconWellViolet: 'border-violet-100 bg-violet-50 text-violet-600',
  iconWellAmber: 'border-amber-100 bg-amber-50 text-amber-600',
  iconWellEmerald: 'border-emerald-100 bg-emerald-50 text-emerald-600',
  iconWellBlue: 'border-blue-100 bg-blue-50 text-blue-600',
  iconWellRose: 'border-rose-100 bg-rose-50 text-rose-600',
  iconWellSlate: 'border-slate-200 bg-slate-50 text-slate-600',

  chip: 'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
  chipNeutral: 'border-slate-200 bg-white text-slate-600',
  chipViolet: 'border-violet-200 bg-violet-50 text-violet-700',
  chipAmber: 'border-amber-200 bg-amber-50 text-amber-800',
  chipEmerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  chipRose: 'border-rose-200 bg-rose-50 text-rose-700',
  chipBlue: 'border-blue-200 bg-blue-50 text-blue-700',

  tabActive:
    'rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-violet-300 transition-all',

  empty: 'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center',
  emptyIcon: 'mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm',
  emptyTitle: 'text-sm font-medium text-slate-800',
  emptyBody: 'mt-1 max-w-sm text-xs leading-relaxed text-slate-500',

  btnPrimary: 'rounded-lg bg-violet-600 text-white hover:bg-violet-700',
  btnOutline: 'rounded-lg border-slate-200',

  sectionLabel: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500',
  value: 'text-sm font-medium text-slate-900',
  muted: 'text-xs text-slate-500',
} as const;

export const labsTone = {
  violet: {
    bar: 'from-violet-500 to-purple-500',
    well: 'border-violet-100 bg-violet-50 text-violet-600',
    soft: 'hover:border-violet-200 hover:bg-violet-50/50',
    accent: 'text-violet-700',
  },
  amber: {
    bar: 'from-amber-500 to-orange-500',
    well: 'border-amber-100 bg-amber-50 text-amber-600',
    soft: 'hover:border-amber-200 hover:bg-amber-50/50',
    accent: 'text-amber-700',
  },
  emerald: {
    bar: 'from-emerald-500 to-teal-500',
    well: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    soft: 'hover:border-emerald-200 hover:bg-emerald-50/50',
    accent: 'text-emerald-700',
  },
  blue: {
    bar: 'from-blue-500 to-indigo-500',
    well: 'border-blue-100 bg-blue-50 text-blue-600',
    soft: 'hover:border-blue-200 hover:bg-blue-50/50',
    accent: 'text-blue-700',
  },
  rose: {
    bar: 'from-rose-500 to-pink-500',
    well: 'border-rose-100 bg-rose-50 text-rose-600',
    soft: 'hover:border-rose-200 hover:bg-rose-50/50',
    accent: 'text-rose-700',
  },
  slate: {
    bar: 'from-slate-400 to-slate-500',
    well: 'border-slate-200 bg-slate-50 text-slate-600',
    soft: 'hover:border-slate-300 hover:bg-slate-50',
    accent: 'text-slate-700',
  },
} as const;

export type LabsToneKey = keyof typeof labsTone;
