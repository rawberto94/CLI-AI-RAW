export default function AIChatLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 dark:from-slate-900 dark:to-violet-950/20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading AI Chat...</p>
      </div>
    </div>
  );
}
