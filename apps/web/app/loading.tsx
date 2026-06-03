export default function RootLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-4">
        {/* ConTigo logo mark */}
        <div className="relative h-12 w-12 animate-pulse">
          <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12 text-violet-600">
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" className="opacity-20" />
            <path
              d="M24 8a16 16 0 0 1 0 32"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="origin-center"
              style={{ animation: 'spin 1.2s linear infinite' }}
            />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            ConTigo
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Loading your contract intelligence platform…
          </p>
        </div>
        {/* Progress bar */}
        <div className="w-48 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-violet-600 rounded-full"
            style={{
              width: '30%',
              animation: 'loading-bar 2s ease-in-out infinite',
            }}
          />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          First load may take a moment through the preview tunnel
        </p>
      </div>
      {/* Inline keyframes via standard style tag (not styled-jsx) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes loading-bar { 
              0% { transform: translateX(-100%); } 
              50% { transform: translateX(100%); } 
              100% { transform: translateX(300%); } 
            }
          `,
        }}
      />
    </div>
  );
}
