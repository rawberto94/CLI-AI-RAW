export default function RFXDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 dark:from-slate-900 dark:to-violet-950/20 p-8">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-7 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-4 w-5/6 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
          <div className="h-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
        </div>
      </div>
    </div>
  );
}
