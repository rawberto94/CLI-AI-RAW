export default function AgentGoalDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 dark:from-slate-900 dark:to-violet-950/20 p-8">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-7 w-56 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      </div>
    </div>
  );
}
