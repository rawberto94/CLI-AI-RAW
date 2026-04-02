export default function IntelligenceLearningLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 dark:from-slate-900 dark:to-violet-950/20 p-8">
      <div className="max-w-[1600px] mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-4 w-80 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      </div>
    </div>
  );
}
