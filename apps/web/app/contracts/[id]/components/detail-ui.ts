/**
 * Shared visual tokens for the contract detail page.
 * Keep cards, fields, chips, and type scale consistent across tabs.
 */

export const detailUi = {
  // Page structure
  pageStack: 'space-y-4 sm:space-y-5',
  sectionGap: 'space-y-4 sm:space-y-6',

  // Cards
  card: 'overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm',
  cardHeader:
    'flex min-h-[56px] flex-col justify-center border-b border-slate-100 bg-slate-50/80 px-4 py-3',
  cardTitle: 'flex items-center gap-2 text-sm font-semibold leading-5 text-slate-800',
  cardDescription: 'text-xs font-medium leading-4 text-slate-500 mt-0.5',
  cardContent: 'flex flex-1 flex-col p-4',

  // Field cells (metadata grid)
  fieldLabel: 'text-xs font-medium leading-4 text-slate-500',
  fieldValue: 'text-sm font-medium leading-5 text-slate-900',
  fieldValueMuted: 'text-sm font-medium leading-5 text-slate-700',
  fieldValueEmphasis: 'text-sm font-semibold leading-5 text-violet-700',
  fieldEmpty: 'text-sm italic leading-5 text-slate-400',
  fieldBadge: 'text-xs font-medium leading-4',
  fieldInput:
    'h-10 text-sm leading-5 bg-white border-slate-200 focus:border-violet-400 focus:ring-violet-400/20 rounded-lg',
  fieldTextarea:
    'min-h-[100px] text-sm leading-5 bg-white border-slate-200 focus:border-violet-400 focus:ring-violet-400/20 rounded-xl resize-none',
  fieldCell:
    'relative flex min-h-[76px] flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:shadow-sm',
  fieldCellAttention:
    'relative flex min-h-[76px] flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-[0_1px_2px_rgba(245,158,11,0.08)] transition-all',
  fieldCellVerified:
    'relative flex min-h-[76px] flex-col gap-1.5 rounded-xl border border-violet-100 bg-violet-50/30 p-3.5 shadow-[0_1px_2px_rgba(139,92,246,0.06)] transition-all',

  // Section collapsibles
  sectionTrigger:
    'flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all cursor-pointer',
  sectionTriggerOpen: 'bg-white border-slate-200 shadow-sm',
  sectionTriggerClosed:
    'bg-slate-50/80 hover:bg-white border-slate-100 hover:border-slate-200',
  sectionIconOpen: 'p-2 rounded-lg bg-violet-50',
  sectionIconClosed: 'p-2 rounded-lg bg-slate-100',
  sectionTitle: 'text-sm font-semibold leading-5 text-slate-800',
  sectionMeta: 'text-xs font-medium leading-4 text-slate-400',
  sectionBody: 'mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 px-0.5 pb-1',

  // Overview tiles
  tile: 'flex h-full min-h-[168px] min-w-0 flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm',
  tileHeader: 'mb-3 flex items-center gap-2.5',
  tileLabel: 'text-xs font-semibold leading-4 uppercase tracking-[0.12em] text-slate-500',
  tileIconWrap: 'rounded-xl bg-violet-100 p-2 shadow-sm',
  tileRow:
    'flex min-h-[48px] min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5',

  // Action chips / pills
  chip: 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-4 transition-colors',
  chipNeutral: 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50/50',
  chipViolet: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
  chipAmber: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
  chipEmerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  chipBlue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',

  // Buttons in card headers
  headerBtn: 'h-8 text-xs font-medium leading-4',
  headerBtnPrimary: 'h-8 text-xs font-medium leading-4 bg-violet-600 hover:bg-violet-700',
} as const
